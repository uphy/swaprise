export type Locale = "en" | "ja";

const locale: Locale = typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";

const JA: Record<string, string> = {
  "Swap & match action puzzle": "入れ替えて揃えるアクションパズル",
  "1 PLAYER": "1人プレイ", "VS CPU": "CPU対戦", "2 PLAYERS": "2人プレイ", ONLINE: "オンライン",
  "endless · time attack · puzzle": "エンドレス・タイムアタック・パズル",
  "easy · normal · hard": "EASY・NORMAL・HARD", "one screen, two players": "1画面で2人対戦",
  ENDLESS: "エンドレス", "TIME ATTACK": "タイムアタック", PUZZLE: "パズル", "◂ BACK": "◂ 戻る",
  EASY: "EASY", NORMAL: "NORMAL", HARD: "HARD", RECORDS: "記録", SETTINGS: "設定", "HOW TO PLAY": "遊び方",
  "BEST {score}   MAX CHAIN x{chain}": "最高 {score}   最大連鎖 x{chain}", "no record yet": "記録なし",
  "{count} / {total} CLEARED": "{count} / {total} クリア", "{wins}W {losses}L": "{wins}勝 {losses}敗",
  "CHOOSE CHARACTERS": "キャラクターを選択", PLAY: "プレイ", BACK: "戻る",
  "some motions pending": "一部の動作は準備中", "artwork pending": "画像は準備中", CLOSE: "閉じる",
  "ENDLESS  TOP 5": "エンドレス  上位5件", "TIME ATTACK 2:00  TOP 5": "タイムアタック 2:00  上位5件",
  "no records yet": "記録なし", "PUZZLE  {count} / {total} cleared": "パズル  {count} / {total} クリア",
  "SOUND: {state}": "サウンド: {state}", "VIBRATION: {state}": "振動: {state}", "FULL SCREEN: {state}": "全画面: {state}",
  ON: "オン", OFF: "オフ", "Line up 3 or more of the same panel to clear them.": "同じパネルを3つ以上揃えると消えます。",
  "Chains and combos send garbage to the opponent.": "連鎖や同時消しで、おじゃまパネルを相手に送れます。",
  "Swap: tap between two panels, or drag a panel sideways": "入れ替え: パネルの間をタップ、または横へドラッグ",
  "Raise: hold ▲ ▲ ▲ under the board, or press the board with 2 fingers": "せり上げ: 盤面下の▲ ▲ ▲を長押し、または2本指で盤面を押す",
  "Pause: the ❚❚ button": "ポーズ: ❚❚ボタン", "Full screen: Share ▸ Add to Home Screen": "全画面: 共有 ▸ ホーム画面に追加",
  "P1: ←↑↓→ move   Z swap   X raise": "1P: ←↑↓→ 移動   Z 入れ替え   X せり上げ",
  "P2: WASD move   F swap   H raise": "2P: WASD 移動   F 入れ替え   H せり上げ",
  "Gamepad: D-pad / stick move   A,B swap   L,R raise": "ゲームパッド: 十字キー/スティック 移動   A,B 入れ替え   L,R せり上げ",
  "Mouse: click between two panels, or drag a panel sideways.": "マウス: パネルの間をクリック、または横へドラッグ。",
  "       Hold ▲ ▲ ▲ under the board to raise": "       盤面下の▲ ▲ ▲を長押ししてせり上げ",
  "P pause   R restart   Esc menu   M mute   V vibration": "P ポーズ   R 再開   Esc メニュー   M 消音   V 振動",
  "{stages} STAGES  x  {puzzles} PUZZLES": "{stages}ステージ  ×  {puzzles}パズル",
  "STAGE {stage}": "ステージ {stage}", "PUZZLE {name}   {moves} MOVE": "パズル {name}   {moves}手",
  "PUZZLE {name}   {moves} MOVES": "パズル {name}   {moves}手", "   CLEARED": "   クリア済み",
  PAUSE: "ポーズ", RESUME: "再開", RESTART: "最初から", MENU: "メニュー", RETRY: "リトライ", SHARE: "共有",
  COPIED: "コピーしました", "SHARE FAILED": "共有に失敗", "NEXT  {name}": "次へ  {name}",
  CLEAR: "クリア", FAILED: "失敗", "MOVES LEFT {count}": "残り手数 {count}", "{count} PANELS LEFT": "残りパネル {count}",
  "NEW RECORD!": "新記録!", "RANK {rank}": "{rank}位", "TIME UP": "時間切れ", "GAME OVER": "ゲームオーバー",
  SCORE: "スコア", "MAX CHAIN": "最大連鎖", COMBOS: "同時消し", CHAINS: "連鎖", DRAW: "引き分け", WIN: "勝利", LOSE: "敗北",
  "UPDATING…": "更新中…", "CHECKING FOR UPDATES…": "更新を確認中…",
  "Connecting…": "接続中…", "Reconnecting…": "再接続中…", "Leaving…": "退出中…",
  "Checking matchmaking…": "マッチングを確認中…", "Cancelling search…": "検索をキャンセル中…",
  "Finding an opponent…": "対戦相手を検索中…", "Search cancelled. You can start again.": "検索をキャンセルしました。再度開始できます。",
  "Could not cancel yet. Please retry.": "まだキャンセルできません。もう一度お試しください。",
  "BACK TO MENU": "メニューへ", RELOAD: "再読み込み", CANCEL: "キャンセル",
  "JOIN ROOM": "ルームに参加", "INVITE FRIEND": "友達を招待", "FIND MATCH": "対戦相手を探す",
  "Name (optional)": "名前（任意）", Guest: "ゲスト", "Choose how to play.": "遊び方を選んでください。",
  "Join your friend’s room.": "友達のルームに参加します。", "This invite link has expired. Create a new room or find a match.": "この招待リンクは期限切れです。新しいルームを作るか、対戦相手を探してください。",
  "Could not complete the request. Check your connection and retry.": "リクエストを完了できませんでした。接続を確認して再試行してください。",
  "Could not check participation. Check your connection and retry.": "参加状態を確認できませんでした。接続を確認して再試行してください。",
  "You have an existing room. Resume here, or leave it to continue.": "参加中のルームがあります。ここで再開するか、退出して続行してください。",
  "You have an existing search. Cancel it to continue here.": "検索中のマッチングがあります。キャンセルして続行してください。",
  "invite a friend · find an opponent": "友達を招待・対戦相手を検索",
  "Checking participation…": "参加状態を確認中…", "The opponent left or the room closed.": "相手が退出したか、ルームが閉じられました。",
  "Surrender this match?": "この対戦を投了しますか？", "Leaving room…": "ルームから退出中…",
  "Could not leave yet. Check your connection and retry.": "まだ退出できません。接続を確認して再試行してください。",
  "P: pause   R: restart   Esc: menu   M: mute": "P: ポーズ   R: 再開   Esc: メニュー   M: 消音",
  "Could not connect. Please retry.": "接続できませんでした。もう一度お試しください。", "Search ended. Check your connection and retry.": "検索が終了しました。接続を確認して再試行してください。",
  "Joining room…": "ルームに参加中…", "CHECK PARTICIPATION": "参加状態を確認", "LEAVE ROOM": "ルームから退出",
  "Waiting for your friend…": "友達の参加を待っています…", "{name} joined. Starting…": "{name} が参加しました。開始します…",
  "The match continues while settings are open.": "設定を開いている間も対戦は続きます。", You: "あなた", Opponent: "相手", playing: "対戦中",
  "NO CONTEST": "無効試合", YOU: "あなた", "YOU WIN!": "勝利!", "YOU LOSE": "敗北",
  " (surrender)": "（投了）", " (disconnected)": "（切断）", " (time limit)": "（時間切れ）", " (out of sync)": "（同期ずれ）", " (connection error)": "（接続エラー）",
  " · Waiting for a rematch…": " · 再戦待ち…", " · Opponent wants a rematch": " · 相手が再戦を希望しています",
  "SHARE INVITE": "招待を共有", "LEAVE AND CONTINUE": "退出して続行", "Play SWAPRISE with me!": "SWAPRISEで一緒に遊ぼう!",
  "Invite link copied.": "招待リンクをコピーしました。", "Could not share the invite.": "招待を共有できませんでした。", "Invite shared.": "招待を共有しました。",
  SURRENDER: "投了", "YES, SURRENDER": "投了する", REMATCH: "再戦", "NEXT MATCH": "次の対戦",
  "Could not leave the room. Return to the menu and try again.": "ルームから退出できませんでした。メニューに戻って再試行してください。",
};

export const language: Locale = locale;

export function t(key: string, values: Record<string, string | number> = {}): string {
  let text = locale === "ja" ? (JA[key] ?? key) : key;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
}

export function setDocumentLanguage(): void {
  if (typeof document !== "undefined") document.documentElement.lang = locale === "ja" ? "ja" : "en";
}
