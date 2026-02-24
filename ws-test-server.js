const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const HTTP_PORT = 7071;
const WS_PORT = 8080;

// ─── Stage Definitions ───────────────────────────────────────────────
const STAGES = [
  { number: 0, name: 'Queued',          durationMs: 500  },
  { number: 1, name: 'Preprocess',      durationMs: 3000 },
  { number: 2, name: 'Text Extraction', durationMs: 5000 },
  { number: 3, name: 'Rule Discovery',  durationMs: 8000 },
  { number: 4, name: 'Output Writer',   durationMs: 2000 },
];

// ─── In-memory state ─────────────────────────────────────────────────
const groups = new Map();    // groupName -> Set<ws>
const activeJobs = new Map(); // groupName -> job info

let sequenceCounter = 0;

// ─── WebSocket Server (mimics Azure Web PubSub) ─────────────────────
const wss = new WebSocketServer({
  port: WS_PORT,
  handleProtocols: (protocols) => {
    // Accept the Web PubSub subprotocol
    if (protocols.has('json.reliable.webpubsub.azure.v1')) {
      return 'json.reliable.webpubsub.azure.v1';
    }
    if (protocols.has('json.webpubsub.azure.v1')) {
      return 'json.webpubsub.azure.v1';
    }
    return false;
  },
});

console.log(`[WS]   WebSocket server running on ws://localhost:${WS_PORT}`);

wss.on('connection', (ws) => {
  const connectionId = crypto.randomUUID();
  ws._groups = new Set();
  console.log(`[WS]   Client connected (${connectionId})`);

  // Send the "connected" system event (required by Web PubSub protocol)
  ws.send(JSON.stringify({
    type: 'system',
    event: 'connected',
    connectionId: connectionId,
    userId: 'test-user',
    reconnectionToken: crypto.randomUUID(),
  }));

  ws.on('message', (data) => {
    const raw = data.toString();
    console.log('[WS]   Received:', raw);

    try {
      const msg = JSON.parse(raw);

      if (msg.type === 'joinGroup') {
        const groupName = msg.group;
        ws._groups.add(groupName);

        if (!groups.has(groupName)) {
          groups.set(groupName, new Set());
        }
        groups.get(groupName).add(ws);

        // Send ack
        ws.send(JSON.stringify({
          type: 'ack',
          ackId: msg.ackId,
          success: true,
        }));

        console.log(`[WS]   Client joined group: ${groupName}`);

        // If there's an active job waiting, start sending stages
        if (activeJobs.has(groupName)) {
          const job = activeJobs.get(groupName);
          if (!job.started) {
            job.started = true;
            sendStageUpdates(groupName, job);
          }
        }
      } else if (msg.type === 'leaveGroup') {
        const groupName = msg.group;
        ws._groups.delete(groupName);
        const members = groups.get(groupName);
        if (members) {
          members.delete(ws);
          if (members.size === 0) groups.delete(groupName);
        }
        ws.send(JSON.stringify({
          type: 'ack',
          ackId: msg.ackId,
          success: true,
        }));
      } else if (msg.type === 'sendToGroup') {
        ws.send(JSON.stringify({
          type: 'ack',
          ackId: msg.ackId,
          success: true,
        }));
      } else if (msg.type === 'event') {
        ws.send(JSON.stringify({
          type: 'ack',
          ackId: msg.ackId,
          success: true,
        }));
      } else if (msg.type === 'sequenceAck') {
        // Client acknowledging receipt, no response needed
      }
    } catch {
      // ignore non-JSON
    }
  });

  ws.on('close', () => {
    console.log(`[WS]   Client disconnected (${connectionId})`);
    for (const groupName of ws._groups) {
      const members = groups.get(groupName);
      if (members) {
        members.delete(ws);
        if (members.size === 0) groups.delete(groupName);
      }
    }
  });
});

function sendToGroup(groupName, message) {
  const members = groups.get(groupName);
  if (!members) return;

  sequenceCounter++;

  const envelope = JSON.stringify({
    type: 'message',
    from: 'group',
    group: groupName,
    fromUserId: 'processing-pipeline',
    dataType: 'json',
    data: message,
    sequenceId: sequenceCounter,
  });

  for (const client of members) {
    if (client.readyState === 1) {
      client.send(envelope);
    }
  }
}

// ─── Stage Simulation ────────────────────────────────────────────────
function sendStageUpdates(groupName, job) {
  let stageIndex = 0;

  function nextStage() {
    if (stageIndex >= STAGES.length) return;

    const stage = STAGES[stageIndex];
    const isFinal = stageIndex === STAGES.length - 1;
    const percentComplete = Math.round(((stageIndex + 1) / (STAGES.length - 1)) * 100);
    const now = new Date().toISOString();

    const stageUpdate = {
      type: 'stage_update',
      correlation_id: job.correlation_id,
      uuid: job.uuid,
      session_id: job.session_id,
      filename: job.filename,
      stage: {
        number: stage.number,
        name: stage.name,
        status: 'completed',
        started_at: now,
        completed_at: now,
        duration_ms: stage.durationMs,
      },
      progress: {
        current_stage: stage.number,
        total_stages: 4,
        percent_complete: isFinal ? 100 : Math.min(percentComplete, 99),
        is_final: isFinal,
      },
      timestamp: now,
    };

    // Add metadata per stage
    if (stage.number === 1) {
      stageUpdate.metadata = { file_size_bytes: 1048576, format: 'PDF' };
    } else if (stage.number === 2) {
      stageUpdate.metadata = { pages_processed: 12, characters_extracted: 45230 };
    } else if (stage.number === 3) {
      stageUpdate.metadata = { rules_found: 47, sections_analyzed: 8 };
    }

    // Add result on final stage
    if (isFinal) {
      stageUpdate.result = {
        status: 'success',
        output_url: `/api/results/${job.uuid}`,
        total_duration_ms: STAGES.reduce((sum, s) => sum + s.durationMs, 0),
        summary: {
          rules_discovered: 47,
          pages_processed: 12,
          confidence_score: 0.94,
        },
      };
    }

    console.log(`[SIM]  Stage ${stage.number} (${stage.name}) -> group ${groupName}`);
    sendToGroup(groupName, stageUpdate);

    stageIndex++;
    if (stageIndex < STAGES.length) {
      const nextDelay = STAGES[stageIndex].durationMs;

      // Send a heartbeat halfway through the next stage
      setTimeout(() => {
        if (stageIndex < STAGES.length) {
          sendToGroup(groupName, {
            type: 'heartbeat',
            correlation_id: job.correlation_id,
            uuid: job.uuid,
            current_stage: STAGES[stageIndex].number,
            stage_name: STAGES[stageIndex].name,
            elapsed_ms: Math.round(nextDelay / 2),
            timestamp: new Date().toISOString(),
          });
        }
      }, Math.round(nextDelay / 2));

      setTimeout(nextStage, nextDelay);
    } else {
      console.log(`[SIM]  Job ${job.correlation_id} complete`);
      activeJobs.delete(groupName);
    }
  }

  // Start after a short delay to ensure the client is ready
  setTimeout(nextStage, 500);
}

// ─── HTTP Server (mimics Azure Function upload handler) ──────────────
const httpServer = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // POST /api/upload
  if (req.method === 'POST' && req.url === '/api/upload') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);

      // Parse filename from multipart form data
      let filename = 'document.pdf';
      const bodyStr = body.toString('latin1');
      const filenameMatch = bodyStr.match(/filename="([^"]+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }

      const session_id = `sess_${crypto.randomUUID()}`;
      const correlation_id = `corr_${crypto.randomUUID()}`;
      const uuid = `file_${crypto.randomUUID()}`;
      const group_name = `job-${correlation_id}`;
      const timestamp = new Date().toISOString();

      const websocket_url = `ws://localhost:${WS_PORT}`;

      const response = {
        status: 'accepted',
        session_id,
        correlation_id,
        uuid,
        filename,
        websocket_url,
        group_name,
        timestamp,
      };

      // Register the job
      activeJobs.set(group_name, {
        ...response,
        started: false,
      });

      console.log(`[HTTP] Upload accepted: ${filename}`);
      console.log(`[HTTP]   correlation_id: ${correlation_id}`);
      console.log(`[HTTP]   group_name:     ${group_name}`);

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'error', message: 'Not found' }));
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`[HTTP] Upload handler running on http://localhost:${HTTP_PORT}/api/upload`);
  console.log('');
  console.log('Ready to test! The flow:');
  console.log('  1. Frontend POSTs file to http://localhost:7071/api/upload');
  console.log('  2. Server returns IDs + websocket_url (ws://localhost:8080)');
  console.log('  3. Frontend connects to WS (Web PubSub protocol) and joins the group');
  console.log('  4. Server sends stage updates: Queued -> Preprocess -> Text Extraction -> Rule Discovery -> Output Writer');
  console.log('  5. Stage timings: 0.5s -> 3s -> 5s -> 8s -> 2s (~18.5s total)');
  console.log('');
});
