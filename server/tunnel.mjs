/* TETH AI 프록시 공개 터널 (계정 불필요, localhost.run)
 * 실행:  cd server && node tunnel.mjs   (프록시 index.mjs가 8799에서 떠 있어야 함)
 * 하는 일: ssh 터널을 유지하고, 발급된 https URL이 바뀔 때마다
 *          저장소 proxy-url 브랜치의 PROXY_URL 파일에 기록한다(gh CLI 사용).
 *          배포된 사이트는 부팅 시 그 파일을 읽어 AI 프록시에 연결한다. */
import { spawn, execFileSync } from "node:child_process";

const REPO = "aresjoo/tesia-lab";
const BRANCH = "proxy-url";
const FILE = "PROXY_URL";
let current = "";

function ghJson(args) {
  try { return JSON.parse(execFileSync("gh", args, { encoding: "utf8" })); } catch (e) { return null; }
}
function publish(url) {
  if (url === current) return;
  try {
    const meta = ghJson(["api", `repos/${REPO}/contents/${FILE}?ref=${BRANCH}`]);
    const args = ["api", "-X", "PUT", `repos/${REPO}/contents/${FILE}`,
      "-f", `message=tunnel: ${url}`,
      "-f", `content=${Buffer.from(url + "\n").toString("base64")}`,
      "-f", `branch=${BRANCH}`];
    if (meta && meta.sha) args.push("-f", `sha=${meta.sha}`);
    execFileSync("gh", args, { encoding: "utf8" });
    current = url;
    console.log(new Date().toISOString(), "pointer updated →", url);
  } catch (e) {
    console.error("pointer update failed:", e.message);
  }
}
function run() {
  console.log(new Date().toISOString(), "opening tunnel...");
  const ssh = spawn("ssh", [
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "ServerAliveInterval=30",
    "-o", "ServerAliveCountMax=3",
    "-o", "ExitOnForwardFailure=yes",
    "-R", "80:localhost:8799",
    "nokey@localhost.run",
  ]);
  const onData = (d) => {
    const m = String(d).match(/https:\/\/[a-z0-9]+\.lhr\.life/);
    if (m) publish(m[0]);
  };
  ssh.stdout.on("data", onData);
  ssh.stderr.on("data", onData);
  ssh.on("close", (code) => {
    console.log(new Date().toISOString(), "tunnel closed (" + code + "), retrying in 5s");
    setTimeout(run, 5000);
  });
}
run();
