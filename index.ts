import "dotenv/config"
import { assertIsDefined } from "./utils"
import axios, { isAxiosError } from "axios"
import * as readline from "readline"
import dayjs from "dayjs"

class Agent {
  constructor(public name: string, public description: string) {}

  introduce(): string {
    return `- ${this.name}: ${this.description}`
  }
}

type MessageRole = "user" | "assistant" | "system"
type Message = { role: MessageRole; content: string }

class Conversation {
  private chatHistory: { name: string; message: string }[] = []
  private initialPrompt: string

  constructor(
    private agenda: string,
    private agents: Agent[],
    private apiKey: string
  ) {
    this.initialPrompt = this.generateInitialPrompt()
  }

  async start(): Promise<void> {
    let continueConversation = true
    let lastAgent: Agent | null = null

    console.log(
      `これから${this.agents.length}人が会話します。お題は「${this.agenda}」です。`
    )
    while (continueConversation) {
      const agent: Agent = lastAgent
        ? this.getRandomAgent(lastAgent)
        : this.agents[0]
      console.log(`${agent.name}が考えています...`)
      const response = await this.chatGpt(agent.name)
      if (!response) return
      this.chatHistory.push({ name: agent.name, message: response })
      console.log(`${agent.name}: ${response}`)

      continueConversation = await this.yesOrNo("続けますか？", true)
      lastAgent = agent
    }

    await this.end()
  }

  private generateInitialPrompt(): string {
    const agentIntroductions = this.agents
      .map((agent) => agent.introduce())
      .join("\n")
    return `
あなた（Assistant）は、${this.agents.length}人がお題：「${this.agenda}」についてディスカッションする様子をシミュレーションします。
話者のプロフィール:
${agentIntroductions}
# 制約条件
- Userが話者の名前を入力したら、Assistantはプロフィールを参考にその人になりきって発言する
- 話者は有名人なので、Assistantはその人格を推測して発言するように努める
- 話者はディスカッションが進行するように努める
- 話者は文脈との関連性の低い発言をしない
- 話者は質問するときに特定の話者を指名しない
- 会話で質問が連続してはいけない
- Userが「まとめ」と入力したら、今までのディスカッションを要約し、結論を生成して終了する
`
  }

  private async chatGpt(prompt: string): Promise<string|void> {
    const messages = this.createMessages4GPT(prompt)
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4",
          messages: messages,
          temperature: 1
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          }
        }
      )
      return response.data.choices[0].message.content.trim()
    } catch (e) {
      if (isAxiosError(e) && e.response) {
        const code = e.response.status
        if (code === 401) {
          console.error("API認証エラー")
          process.exit(1)
        } else if (code === 429) {
          console.warn("リクエスト制限に引っかかりました")
          return await this.whenChatGptError(prompt)
        } else {
          console.warn("OpenAIでエラーが起きました")
          return await this.whenChatGptError(prompt)
        }
      } else {
        console.error(e)
        throw new Error("Unknown error")
      }
    }
  }

  private async whenChatGptError(prompt: string): Promise<string|void> {
    const tryAgain = await this.yesOrNo("もう一度試しますか?（しない場合は会話を終了します）", true)
    if (tryAgain) {
      return this.chatGpt(prompt)
    } else {
      return
    }
  }

  private createMessages4GPT(prompt: string): Message[] {
    const prevMessages: Message[] = this.chatHistory
      .map((entry) => {
        return [
          { role: "user", content: entry.name },
          { role: "assistant", content: entry.message }
        ] as [Message, Message]
      })
      .flat()
    return [
      { role: "system", content: this.initialPrompt },
      ...prevMessages,
      { role: "user", content: prompt }
    ]
  }

  private async getUserInput(question: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close()
        resolve(answer)
      })
    })
  }

  private async yesOrNo(
    title: string,
    isDefaultYes: boolean = true
  ): Promise<boolean> {
    const optionText = isDefaultYes ? "Y/n" : "y/N"
    const answer = await this.getUserInput(`${title} (${optionText}):`)
    const isYes =
      answer.toLowerCase() === "y" ||
      (isDefaultYes && answer.toLowerCase() !== "n")
    return isYes
  }

  private getRandomAgent(exclude?: Agent): Agent {
    const eligibleAgents = this.agents.filter((agent) => agent !== exclude)
    return eligibleAgents[Math.floor(Math.random() * eligibleAgents.length)]
  }

  async end(): Promise<void> {
    console.log("会話をまとめています...")
    const conclusion = await this.chatGpt("まとめ")
    if (!conclusion) return
    console.log(`まとめ: ${conclusion}`)
    const conversationData = {
      agenda: this.agenda,
      agents: this.agents,
      chatHistory: this.chatHistory,
      conclusion
    }

    const timestamp = dayjs().format("YYYYMMDD-HHmmss")
    const fs = require("fs")
    fs.writeFileSync(
      `logs/${timestamp}.json`,
      JSON.stringify(conversationData, null, 2)
    )
  }
}

const agenda = "デートで男性は女性におごるべきか？"

const agent1 = new Agent(
  "ソクラテス",
  `質問ばかりする年寄りの哲学者。
@一人称:「儂」
@二人称:「そなた」
@口調の例
「〜じゃ」「ならば何故〜のかね？」「〜かも知れぬ」`
)
const agent2 = new Agent(
  "カント",
  `中年の哲学者
@一人称:「儂」
@二人称:「君」
@口調の例
「〜です」「しかしながら」「これはこれは」`
)
const agent3 = new Agent(
  "フワちゃん",
  `テンションMaxのインフルエンサー
@一人称:「フワちゃん」
@二人称:ちゃん付け
@口調の例
「〜っしょ」「ぎゃははははは」「それなーに？」「マジサイコー」`
)

assertIsDefined(process.env.OPENAI_API_KEY)
const conversation = new Conversation(
  agenda,
  [agent1, agent2, agent3],
  process.env.OPENAI_API_KEY
)
conversation.start()
