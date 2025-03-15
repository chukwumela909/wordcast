const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { 
  AccessToken, 
  IngressClient, 
  RoomServiceClient,
  IngressInput,
  IngressVideoEncodingPreset,
  IngressAudioEncodingPreset,
  TrackSource
} = require('livekit-server-sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Helper functions
function generateRoomId() {
  return `${randomString(4)}-${randomString(4)}`;
}

function randomString(length) {
  let result = '';
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function createAuthToken(room_name, identity) {
  return jwt.sign(
    JSON.stringify({ room_name, identity }),
    process.env.LIVEKIT_API_SECRET
  );
}

function getSessionFromReq(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  if (!token) {
    throw new Error('No authorization header found');
  }
  const verified = jwt.verify(token, process.env.LIVEKIT_API_SECRET);
  if (!verified) {
    throw new Error('Invalid token');
  }
  const decoded = jwt.decode(token);
  return decoded;
}

function getOrCreateParticipantMetadata(participant) {
  if (participant.metadata) {
    return JSON.parse(participant.metadata);
  }
  return {
    hand_raised: false,
    invited_to_stage: false,
    avatar_image: `https://api.multiavatar.com/${participant.identity}.png`,
  };
}

// LiveKit service initialization
function getLivekitServices() {
  const httpUrl = process.env.LIVEKIT_WS_URL
    .replace('wss://', 'https://')
    .replace('ws://', 'http://');
  
  return {
    ingressService: new IngressClient(httpUrl),
    roomService: new RoomServiceClient(
      httpUrl,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET
    )
  };
}

// Routes
app.post('/api/create_ingress', async (req, res) => {
  try {
    const { room_name, ingress_type = 'rtmp', metadata } = req.body;
    const { ingressService, roomService } = getLivekitServices();
    
    const actualRoomName = room_name || generateRoomId();

    // Create room
    await roomService.createRoom({
      name: actualRoomName,
      metadata: JSON.stringify(metadata),
    });

    // Create ingress
    const options = {
      name: actualRoomName,
      roomName: actualRoomName,
      participantName: metadata.creator_identity + ' (via OBS)',
      participantIdentity: metadata.creator_identity + ' (via OBS)',
    };

    if (ingress_type === 'whip') {
      options.bypassTranscoding = true;
    } else {
      options.video = {
        source: TrackSource.CAMERA,
        preset: IngressVideoEncodingPreset.H264_1080P_30FPS_3_LAYERS,
      };
      options.audio = {
        source: TrackSource.MICROPHONE,
        preset: IngressAudioEncodingPreset.OPUS_STEREO_96KBPS,
      };
    }

    const ingress = await ingressService.createIngress(
      ingress_type === 'whip'
        ? IngressInput.WHIP_INPUT
        : IngressInput.RTMP_INPUT,
      options
    );

    // Create viewer access token
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: metadata.creator_identity,
      }
    );

    at.addGrant({
      room: actualRoomName,
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
      canPublishData: true,
    });

    const authToken = createAuthToken(
      actualRoomName,
      metadata.creator_identity
    );

    res.json({
      ingress,
      auth_token: authToken,
      connection_details: {
        ws_url: process.env.LIVEKIT_WS_URL,
        token: at.toJwt(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/create_stream', async (req, res) => {
  try {
    const { room_name, metadata } = req.body;
    const { roomService } = getLivekitServices();
    
    const actualRoomName = room_name || generateRoomId();

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: metadata.creator_identity,
      }
    );

    at.addGrant({
      room: actualRoomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    await roomService.createRoom({
      name: actualRoomName,
      metadata: JSON.stringify(metadata),
    });

    const authToken = createAuthToken(actualRoomName, metadata.creator_identity);

    res.json({
      auth_token: authToken,
      connection_details: {
        ws_url: process.env.LIVEKIT_WS_URL,
        token: at.toJwt(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/join_stream', async (req, res) => {
  try {
    const { room_name, identity } = req.body;
    const { roomService } = getLivekitServices();
    
    // Check for existing participant with same identity
    let exists = false;
    try {
      await roomService.getParticipant(room_name, identity);
      exists = true;
    } catch {}

    if (exists) {
      throw new Error('Participant already exists');
    }

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity,
      }
    );

    at.addGrant({
      room: room_name,
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
      canPublishData: true,
    });

    const authToken = createAuthToken(room_name, identity);

    res.json({
      auth_token: authToken,
      connection_details: {
        ws_url: process.env.LIVEKIT_WS_URL,
        token: at.toJwt(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/invite_to_stage', async (req, res) => {
  try {
    const session = getSessionFromReq(req);
    const { identity } = req.body;
    const { roomService } = getLivekitServices();

    const rooms = await roomService.listRooms([session.room_name]);

    if (rooms.length === 0) {
      throw new Error('Room does not exist');
    }

    const room = rooms[0];
    const creator_identity = JSON.parse(room.metadata).creator_identity;

    if (creator_identity !== session.identity) {
      throw new Error('Only the creator can invite to stage');
    }

    const participant = await roomService.getParticipant(
      session.room_name,
      identity
    );
    const permission = participant.permission || {};

    const metadata = getOrCreateParticipantMetadata(participant);
    metadata.invited_to_stage = true;

    // If hand is raised and invited to stage, then we let them on stage
    if (metadata.hand_raised) {
      permission.canPublish = true;
    }

    await roomService.updateParticipant(
      session.room_name,
      identity,
      JSON.stringify(metadata),
      permission
    );

    res.json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/raise_hand', async (req, res) => {
  try {
    const session = getSessionFromReq(req);
    const { roomService } = getLivekitServices();

    const participant = await roomService.getParticipant(
      session.room_name,
      session.identity
    );

    const permission = participant.permission || {};
    const metadata = getOrCreateParticipantMetadata(participant);
    metadata.hand_raised = true;

    // If hand is raised and invited to stage, then we let them on stage
    if (metadata.invited_to_stage) {
      permission.canPublish = true;
    }

    await roomService.updateParticipant(
      session.room_name,
      session.identity,
      JSON.stringify(metadata),
      permission
    );

    res.json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/remove_from_stage', async (req, res) => {
  try {
    const session = getSessionFromReq(req);
    let { identity } = req.body;
    const { roomService } = getLivekitServices();

    if (!identity) {
      // remove self if no identity specified
      identity = session.identity;
    }

    const rooms = await roomService.listRooms([session.room_name]);

    if (rooms.length === 0) {
      throw new Error('Room does not exist');
    }

    const room = rooms[0];
    const creator_identity = JSON.parse(room.metadata).creator_identity;

    if (
      creator_identity !== session.identity &&
      identity !== session.identity
    ) {
      throw new Error(
        'Only the creator or the participant themselves can remove from stage'
      );
    }

    const participant = await roomService.getParticipant(
      session.room_name,
      identity
    );

    const permission = participant.permission || {};
    const metadata = getOrCreateParticipantMetadata(participant);

    // Reset everything and disallow them from publishing
    metadata.hand_raised = false;
    metadata.invited_to_stage = false;
    permission.canPublish = false;

    await roomService.updateParticipant(
      session.room_name,
      identity,
      JSON.stringify(metadata),
      permission
    );

    res.json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stop_stream', async (req, res) => {
  try {
    const session = getSessionFromReq(req);
    const { roomService } = getLivekitServices();

    const rooms = await roomService.listRooms([session.room_name]);

    if (rooms.length === 0) {
      throw new Error('Room does not exist');
    }

    const room = rooms[0];
    const creator_identity = JSON.parse(room.metadata).creator_identity;

    if (creator_identity !== session.identity) {
      throw new Error('Only the creator can stop the stream');
    }

    await roomService.deleteRoom(session.room_name);

    res.json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

});