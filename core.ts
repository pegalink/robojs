import axios, { AxiosInstance } from 'axios';
const WebSocketLib = require('ws');
const EventEmitter = require('events');

enum Dintents {
  Guilds = 1 << 0,
  GuildMembers = 1 << 1,
  GuildModeration = 1 << 2,
  GuildExpressions = 1 << 3,
  GuildIntegrations = 1 << 4,
  GuildWebhooks = 1 << 5,
  GuildInvites = 1 << 6,
  GuildVoiceStates = 1 << 7,
  GuildPresences = 1 << 8,
  GuildMessages = 1 << 9,
  MessageContent = 1 << 15
}

interface ClientOptions {
  intents: number[];
  token: string;
}

interface CreateMessageOptions {
  content: string
}

enum DiscordEvents {
  Ready = 'READY',
  MessageCreate = 'MESSAGE_CREATE'
  // Add more events as needed
}

class Client extends EventEmitter {
  private token: string;
  private intents: number[];
  private ws: any;
  private heartbeatInterval: NodeJS.Timeout | null;
  private heartbeatTimeout: NodeJS.Timeout | null;
  private axiosInstance: AxiosInstance
  private lastsequence: Number

  constructor(options: ClientOptions) {
    super();
    this.token = options.token;
    this.intents = options.intents;
  }
  async heartbeat(interval: number) {
    return setTimeout(() => {
      this.ws.send(JSON.stringify({op: 1, d: null}))
    }, interval)
  }
  async voiceStateUpdate(guildId: string, channelId: any, self_muted: boolean, self_deafen: boolean) {
    const response = await this.axiosInstance.get(`https://discord.com/api/v9/guilds/${guildId}`);
    if (response.statusText === 'OK' && response.data.id === guildId) {
      const params = {
        op: 4,
        d: {
          guild_id: guildId,
          channel_id: channelId,
          self_mute: self_muted,
          self_deaf: self_deafen
        }
      }
      this.ws.send(JSON.stringify(params))
    }
  }
  async fetchGuild(id: string) {
    const call = await this.axiosInstance.get(`https://discord.com/api/v9/guilds/${id}`);
    if (call.status === 200) {
      return call.data;
    } else {
      throw new Error(`Error happened while fetching guild: ${call.status}, ${call.statusText}`)
    }
  }
  async createMessage(channelid: string, message: string) {
    const params = {
      content: message
    }
    const call = await this.axiosInstance.post(`https://discord.com/api/v9/channels/${channelid}/messages`, params);
    if (call.status === 200) {
      return call.data;
    } else {
      throw new Error(`Error happened while creating a new message: ${call.status}, ${call.statusText}`)
    }
  }
  async login() {
    // Important DATA
    let retry_session;
    let validationCode;
    try {
      const wsUrl = 'wss://gateway.discord.gg/?v=10&encoding=json';
      const axiosstance = axios.create({
        headers: {
          'Authorization': `Bot ${this.token}`,
        },
      });
      this.axiosInstance = axiosstance;
      this.ws = new WebSocketLib(wsUrl);
      const identifyIntents = this.intents.reduce((acc, current) => acc + current, 0);
      const payload = {
        op: 2,
        d: {
          token: `Bot ${this.token}`,
          intents: 33281,
          properties: {
            os: 'windows',
            browser: 'robo.js',
            device: 'robo.js'
          }
        }
      }
      this.ws.once('open', () => {
        console.log('Connected to Discord gateway');
        this.ws.send(JSON.stringify(payload))
      });
  
      this.ws.on('message', async (message) => {
        const data = JSON.parse(message);
        const { d, event, op, t, s } = data;
        switch (op) {
          case 10: // Hello
            console.log(`Hello discord! Thanks, I now know that my heartbeat interval is ${data.d.heartbeat_interval}`)
            this.heartbeat(35000)
            break;
          case 0: // Dispatch
          if (s === null) {

          } else {
            this.lastsequence = s;
          }
            if (data.t === 'READY') {
              const userData = data.d;
              this.emit(DiscordEvents.Ready, userData.user);
            }
            if (data.t === 'MESSAGE_CREATE') {
              this.emit(DiscordEvents.MessageCreate, d)
            }
            break;
          case 1: // Heartbeat requested from discord
            this.ws.send(JSON.stringify({op: 1, d: null}))
            console.log('Sending additional heartbeat request, as discord requested')
            break;
          case 11:
            console.log('Recevied confirmation that discord indeed recevied heartbeat request. Continuing...')
            break;
          default:
            console.log(`Received unknown opcode ${data.op}`);
            break;
        }
      });
  
      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
  
      this.ws.on('close', (code, reason) => {
        console.log(`WebSocket connection closed with code ${code} and reason ${reason}. Reconnecting...`); // Reconnect on close
      });
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
    }
  }
}

module.exports = { Client, DiscordEvents, Dintents };
