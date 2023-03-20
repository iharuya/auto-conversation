import axios, { isAxiosError } from "axios"
import * as fs from "fs"
import { assertIsDefined, getUserInput } from "./utils"
import { SingleBar, Presets } from "cli-progress"
import {execSync} from "child_process"

const baseUrl = `http://localhost:50021`

type Speaker = {
  name: string
  voiceId: number
}
type Agent = {
  name: string
  description: string
}
type Chat = {
  name: string
  message: string
}
class SpeechFactory {
  private speakers: Speaker[] = []
  private agenda: string
  private agents: Agent[]
  private chats: Chat[]
  private conclusion: string
  private generatingBar: SingleBar
  private tmpWavNames: string[] = []

  constructor(private filePath: string) {
    const file = fs.readFileSync(this.filePath, "utf8")
    const data = JSON.parse(file)
    if (typeof data.agenda === "string") {
      this.agenda = data.agenda
    } else {
      throw new Error("agenda not found")
    }
    if (typeof data.conclusion === "string") {
      this.conclusion = data.conclusion
    } else {
      throw new Error("conclusion not found")
    }
    if (
      Array.isArray(data.agents) &&
      data.agents.every(
        (msg: any) =>
          typeof msg.name === "string" && typeof msg.description === "string"
      )
    ) {
      this.agents = data.agents as Agent[]
    } else {
      throw new Error("format error in agents")
    }
    if (
      Array.isArray(data.chatHistory) &&
      data.chatHistory.every(
        (msg: any) =>
          typeof msg.name === "string" && typeof msg.message === "string"
      )
    ) {
      this.chats = data.chatHistory as Chat[]
    } else {
      throw new Error("format error in chatHistory")
    }

    this.generatingBar = new SingleBar({}, Presets.shades_classic)
    this.generatingBar = new SingleBar({}, Presets.shades_classic)
    this.configure()
  }

  private async configure() {
    console.log(`${this.agents.length}人が見つかりました`)
    for (const agent of this.agents) {
      const rawId = await getUserInput(
        `${agent.name}のVOICEVOXのIDを入力（Int）: `
      )
      const id = parseInt(rawId)
      if (isNaN(id)) {
        throw new Error("整数を入力してください")
      }
      this.speakers.push({
        name: agent.name,
        voiceId: id
      })
    }
    this.generate()
  }

  private async generate() {
    this.generatingBar.start(this.chats.length + 2, 0)
    await this.addSpeech(this.generateIntro(), 24)
    this.generatingBar.increment()
    for (const chat of this.chats) {
      const voiceId = this.speakers.find((speaker) => speaker.name === chat.name)?.voiceId
      assertIsDefined(voiceId)
      await this.addSpeech(chat.message, voiceId)
      this.generatingBar.increment()
    }
    await this.addSpeech(this.generateOutro(), 24)
    this.generatingBar.increment()
    this.generatingBar.stop()
    this.concatenate()
  }

  private concatenate() {
    console.log(`ファイルを結合中...`)
    const filePaths = this.tmpWavNames.map((name) => `-i tmp/${name}`).join(" ")
    const brackets = this.tmpWavNames.map((_, i) => `[${i}:a]`).join("")
    const speechFilePath = `speeches/${Date.now()}.wav`
    execSync(`ffmpeg ${filePaths} -filter_complex "${brackets}concat=n=${this.tmpWavNames.length}:v=0:a=1[out]" -map "[out]" ${speechFilePath} -nostats -loglevel "error"`)
    console.log(`${speechFilePath}に保存しました`)
    execSync(`rm -f ${this.tmpWavNames.map((name) => `tmp/${name}`).join(" ")}`)
  }

  private generateIntro(): string {
    const names = this.agents.map((agent, index) => {
      if (index+1 === this.agents.length) {
        return `そして${agent.name}さん`
      }
      return `${agent.name}さん、`
    })
    return `さてさて本日は${names}の、以上${this.agents.length}名の特別ゲストの皆様に議論をしていただきたいと思いまーす。お題は「${this.agenda}」です。それではどうぞ！`
  }
  private generateOutro(): string {
    return `さて本日はここまでにしましょう。みなさんどうだったでしょうか。${this.conclusion}それでは次回もまたお会いしましょう！`
  }

  private async addSpeech(text: string, voiceId: number) {
    const query = await this.createQuery(text, voiceId)
    const wav = await this.generateWav(query, voiceId)
    const fileName = `${Date.now()}.wav`
    fs.writeFileSync(`tmp/${fileName}`, wav)
    this.tmpWavNames.push(fileName)
  }

  private async createQuery(text: string, voiceId: number): Promise<{}> {
    try {
      const res = await axios.post(`${baseUrl}/audio_query`, null, {
        params: {
          text,
          speaker: voiceId
        }
      })
      return res.data
    } catch (e) {
      console.error(e)
      throw new Error("failed to create query")
    }
  }

  private async generateWav(data: any, voiceId: number): Promise<any> {
    try {
      const res = await axios.post(`${baseUrl}/synthesis`, data, {
        params: {
          speaker: voiceId,
          enable_interrogative_upspeak: true
        },
        responseType: "arraybuffer"
      })
      return res.data
    } catch (e) {
      console.error(e)
      throw new Error("fail to speech")
    }
  }
}

const inputFilePath = `logs/20230321-011111.json`
new SpeechFactory(inputFilePath)
