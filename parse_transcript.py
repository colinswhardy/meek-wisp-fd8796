import json
import os

transcript_path = r"C:\Users\Colin's PC\.gemini\antigravity\brain\0d66f3df-9023-42b9-a8fe-5cd95e24b1bc\.system_generated\logs\transcript.jsonl"

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            obj = json.loads(line)
            step = obj.get("step_index")
            
            if step in [89, 105]:
                tool_calls = obj.get("tool_calls", [])
                for tc in tool_calls:
                    args = tc.get("args", {})
                    if "ReplacementContent" in args:
                        content = args.get("ReplacementContent")
                        filename = f"step_{step}_content.txt"
                        with open(filename, 'w', encoding='utf-8') as out_f:
                            out_f.write(content)
                        print(f"Wrote {filename}")
        except Exception as e:
            pass
