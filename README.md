# 自動会話

## 設計

- Agentオブジェクトは性格や特徴を示す文章とともにインスタンス化される
- Conversationオブジェクトはインスタンス化されるときに以下の情報が渡される
  - 複数のAgentインスタンス
  - 会話のお題（agenda）
- conversation.start()は以下を順に実行する
  1. はじめにChatGPTに与える文章を英語で作る。これは以下の内容を含む
    - これからagents.length人でagendaについて会話すること
    - Userがagentの名前を言ったら、それになりきって回答すること
    - Userがconcludeと言ったら会話を要約して結論を出すこと
    - 各agentの説明
    - agents[0].nameから始めること
    - これ以降はすべて日本語を使うこと
  2. chatgptのAPIからレスポンスを取得し、console.logで出力する
  3. 会話を続けるかどうか（y/n）のCLI入力を待つ
  4. yの場合はagentの名前をランダムに選び、2を実行する。ただし同じagentが連続することがないようにする。
  5. nの場合はend()を実行する
- それぞれのagentによるチャットはagentの名前とともにConversationに保存される
- conversation.end()は以下を実行する
  - "conclude"とChatGPTに送り、その結果を待つ
  - すべてのagentの情報, 保存されたチャット, 結論をjson形式で保存する 
