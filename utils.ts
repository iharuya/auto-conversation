export function assertIsDefined<T>(val: T): asserts val is NonNullable<T> {
  if (val === undefined || val === null) {
    throw new Error(`Expected 'val' to be defined, but received ${val}`)
  }
}

import * as readline from "readline"
export const getUserInput = async(title: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  return new Promise((resolve) => {
    rl.question(title, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}


export const yesOrNo = async(
  title: string,
  isDefaultYes: boolean = true
): Promise<boolean> => {
  const optionText = isDefaultYes ? "Y/n" : "y/N"
  const answer = await getUserInput(`${title} (${optionText}):`)
  const isYes =
    answer.toLowerCase() === "y" ||
    (isDefaultYes && answer.toLowerCase() !== "n")
  return isYes
}