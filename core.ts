const axios = require('axios');
const { AxiosInstance } = require('axios');
const WebSocketLib = require('ws');
const EventEmitter = require('events');
let axiosInstanceAll: typeof axios.AxiosInstance;
enum DiscordIntents {
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
  GuildMessageReactions = 1 << 10,
  GuildMessageTyping = 1 << 11,
  DirectMessages = 1 << 12,
  DirectMessageReactions = 1 << 13,
  DirectMessageTyping = 1 << 14,
  MessageContent = 1 << 15,
  GuildScheduledEvents = 1 << 16,
  AutoModerationConfiguration = 1 << 20,
  AutoModerationExecution = 1 << 21,
  GuildMessagePolls = 1 << 24,
  DirectMessagePolls = 1 << 25
}

interface ClientOptions {
  intents: number[];
  token: string;
}

enum DiscordEvents {
  Ready = 'READY',
  MessageCreate = 'MESSAGE_CREATE'
}
/*
enum ChannelType {
  GuildText = 0,
  DM = 1,
  GuildVoice = 2,
  GroupDM = 3,
  GuildCategory = 4,
  GuildAnnoucement = 5,
  AnnoucementThread = 10,
  PublicThread = 11,
  PrivateThread = 12,
  GuildStage = 13,
  GuildDirectory = 14,
  GuildForum = 15
}

NOT YET KNOWN ON HOW IT WOULD BE IMPLEMENTED

*/

class Guild {
  public id: string;
  public name: string;
  public client: any;
  constructor(data, client) {
    this.id = data.id;
    this.name = data.name;
    this.client = client;
  }

  async fetchChannel(id: String) {
    return new Promise(async (resolve, reject) => {
      const call = await axiosInstanceAll.get(`https://discord.com/api/v9/guilds/${id}/channels/${this.id}`);
      if (call.status === 200) {
        const d = call.data;
        const channelData = {
          id: d.id,
          name: d.name,
          type: d.type
        }
        resolve(new Channel(channelData, this));
      } else {
        reject(`An error happened while fetching channel: ${call.status}, ${call.statusText}`)
      }
    });
  }
}

class Channel {
  public id: string;
  public name: string;
  public type: any;
  public client: any;
  public guild: any
  constructor(data, client) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.client = client;
    this.guild = data.guild
  }

    createMessage = async (content: string) => {
    const params = {
      "content": content
    };
    return new Promise(async (resolve, reject) => {
      const call = await axiosInstanceAll.post(`https://discord.com/api/v9/channels/${this.id}/messages`, params);
      if (call.status === 200) {
        resolve(call);
      } else {
        reject(`An error happened while sending a message: ${call.status}, ${call.statusText}`)
      }
    });
  }
}

class Message {
  public id: string;
  public content: string;
  public channel: Channel;
  public author: any;
  constructor(data, client) {
    this.id = data.id;
    this.content = data.content;
    this.channel = new Channel(data.channel, client);
    this.author = data.author;
  }

  createMessage = async (content: string) => {
    this.channel.createMessage(content)
  }
  createReply = async (content: string) => {
    const call = await axiosInstanceAll.get(`https://discord.com/api/v9/channels/${this.id}`);
    if (call.status !== 200) {
      throw new Error(`An error occoured while replying: ${call.status}, ${call.statusText}.`)
    }
    const guildid = call.data.guild_id;
    const params = {
      "content": content,
      "message_reference": {
        "message_id": this.id,
        "guild_id": guildid
      }
    };
    return new Promise(async (resolve, reject) => {
      const call = await axiosInstanceAll.post(`https://discord.com/api/v9/channels/${this.channel.id}/messages`, params);
      if (call.status === 200) {
        resolve(call);
      } else {
        reject(`An error happened while sending a message: ${call.status}, ${call.statusText}`)
      }
    });
  }
}

class Client extends EventEmitter {
  private token: string;
  private intents: number[];
  private ws: any;
  public axiosInstance: typeof AxiosInstance
  private lastsequence: Number
  private websocketUrlForReconnect: string = 'wss://gateway.discord.gg'
  private sessionId: any
  private acknowledgedHeartbeat: boolean
  private heartbeatInterval?: ReturnType<typeof setInterval>;

  constructor(options: ClientOptions) {
    super();
    this.token = options.token;
    this.intents = options.intents;
  }
  heartbeat(interval: number) {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.acknowledgedHeartbeat = true;
    this.heartbeatInterval = setInterval(() => {
      if (!this.acknowledgedHeartbeat) {
        console.warn('No heartbeat ack received, terminating connection.');
        this.ws.terminate();
        clearInterval(this.heartbeatInterval!);
        return;
      }
      this.acknowledgedHeartbeat = false;
      this.ws.send(JSON.stringify({ op: 1, d: this.lastsequence }));
    }, interval);
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
    return new Promise(async (resolve, reject) => {
      const call = await this.axiosInstance.get(`https://discord.com/api/v9/guilds/${id}`);
      if (call.status === 200) {
        const d = call.data;
        const guildData = {
          id: d.id,
          name: d.name,
        }
        resolve(new Guild(guildData, this))
      } else {
        reject(`An error occoured while fetching a guild: ${call.status}, ${call.statusText}`);
      }
    });
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
    try {
      const wsUrl = 'wss://gateway.discord.gg/?v=10&encoding=json';
      const axiosstance = axios.create({
        headers: {
          'Authorization': `Bot ${this.token}`,
          'Content-Type': 'application/json'
        },
      });
      this.axiosInstance = axiosstance;
      axiosInstanceAll = axiosstance;

      const mhm = this.intents.reduce((sum, num) => sum + num, 0);
      const identifyPayload = {
        op: 2,
        d: {
          token: `Bot ${this.token}`,
          intents: mhm,
          properties: {
            os: 'windows',
            browser: 'robo.js',
            device: 'robo.js'
          }
        }
      };

      const connect = (url: string, resume = false) => {
        this.ws = new WebSocketLib(url);
        this.ws.once('open', () => {
          let payload: any;
          if (resume && this.sessionId) {
            payload = { op: 6, d: { token: `Bot ${this.token}`, session_id: this.sessionId, seq: this.lastsequence } };
          } else {
            payload = identifyPayload;
          }
          console.log(resume && this.sessionId ? 'Resuming session' : 'Identifying to gateway');
          this.ws.send(JSON.stringify(payload));
        });

        this.ws.on('message', async (message: string) => {
          const data = JSON.parse(message);
          const { d, op, t, s } = data;
          if (s != null) this.lastsequence = s;

          if (op === 10) {
            this.acknowledgedHeartbeat = false;
            this.heartbeat(data.d.heartbeat_interval);
          } else if (op === 0) {
            if (t === DiscordEvents.Ready) {
              this.sessionId = d.session_id;
              this.websocketUrlForReconnect = d.resume_gateway_url;
              this.emit(DiscordEvents.Ready, d.user);
            } else if (t === DiscordEvents.MessageCreate) {
              const msg = new Message({
                id: d.id,
                content: d.content,
                author: d.author,
                channel: { id: d.channel_id, name: null, type: null }
              }, this);
              this.emit(DiscordEvents.MessageCreate, msg);
            }
          } else if (op === 1) {
            this.ws.send(JSON.stringify({ op: 1, d: null }));
            this.acknowledgedHeartbeat = false;
          } else if (op === 11) {
            this.acknowledgedHeartbeat = true;
          }
        });

        this.ws.on('error', (error) => console.error('WebSocket error:', error));
        this.ws.on('close', (code, reason) => {
          console.warn(`WebSocket closed with code ${code}, reason: ${reason.toString()}`);
          const url = this.sessionId ? this.websocketUrlForReconnect : wsUrl;
          setTimeout(() => connect(url, Boolean(this.sessionId)), 5000);
        });
      };

      connect(wsUrl);
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
    }
  }
}

module.exports = { Client, DiscordEvents, DiscordIntents };
