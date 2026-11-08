import path from "path";
import fs from "fs";
import {downloadWhisperModel, installWhisperCpp, transcribe, toCaptions} from "@remotion/install-whisper-cpp";

const to = path.join(process.cwd(), "whisper.cpp");
await installWhisperCpp({to, version: "1.5.5"});
await downloadWhisperModel({model: "small.en", folder: to});
const whisperCppOutput = await transcribe({
  model: "small.en",
  whisperPath: to,
  whisperCppVersion: "1.5.5",
  inputPath: path.join(process.cwd(), "voiceover16k.wav"),
  tokenLevelTimestamps: true,
});
const {captions} = toCaptions({whisperCppOutput});
fs.writeFileSync("public/audio/voiceover-captions.json", JSON.stringify(captions, null, 2));
console.log(captions.map((c) => `${(c.startMs / 1000).toFixed(2)}-${(c.endMs / 1000).toFixed(2)} ${c.text}`).join("\n"));
