/**
 * Best-effort parser that turns a raw stack trace into frames, for the common formats:
 * Node.js / browser JavaScript, Python, Go, Java/Kotlin, and .NET. Lines that are not
 * frames (the error message, "Caused by:", "goroutine 1 [running]:") are kept as headers.
 *
 * Returns { language, frames: [{ fn, file, line, column, code, inApp, raw }], headers: [] }.
 * When nothing parses, `frames` is empty and callers should show the raw text.
 */
export function parseStackTrace(text) {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  const frames = [];
  const headers = [];
  let language = "";

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) continue;

    // JavaScript (V8): "at fn (file:line:col)" or "at file:line:col"
    let match = line.match(/^at (?:(.+?) \()?((?:[a-zA-Z]+:\/\/|node:|\/|[A-Za-z]:\\|\.{0,2}\/?)?[^()]*?):(\d+)(?::(\d+))?\)?$/);
    if (match && line.startsWith("at ") && !/\(.*\.java:\d+\)$/.test(line)) {
      language ||= "javascript";
      frames.push(frame(match[1] || "<anonymous>", match[2], match[3], match[4], raw));
      continue;
    }
    // JavaScript (Firefox/Safari): "fn@file:line:col"
    match = line.match(/^(.*?)@(.+?):(\d+):(\d+)$/);
    if (match) {
      language ||= "javascript";
      frames.push(frame(match[1] || "<anonymous>", match[2], match[3], match[4], raw));
      continue;
    }
    // Python: 'File "path", line N, in fn' followed by the source line
    match = line.match(/^File "(.+)", line (\d+), in (.+)$/);
    if (match) {
      language ||= "python";
      const next = lines[index + 1]?.trim();
      const hasCode = next && !next.startsWith("File ") && !/^\w+(Error|Exception)\b/.test(next) && !next.startsWith("Traceback");
      frames.push({ ...frame(match[3], match[1], match[2], "", raw), code: hasCode ? next : "" });
      if (hasCode) index += 1;
      continue;
    }
    // Java / Kotlin: "at pkg.Class.method(File.java:123)"
    match = line.match(/^at ([\w$.<>/]+)\(([^:()]+)(?::(\d+))?\)$/);
    if (match) {
      language ||= "java";
      frames.push(frame(match[1], match[2], match[3], "", raw));
      continue;
    }
    // .NET: "at Namespace.Type.Method() in C:\path\File.cs:line 42"
    match = line.match(/^at (.+?) in (.+):line (\d+)$/);
    if (match) {
      language ||= "dotnet";
      frames.push(frame(match[1], match[2], match[3], "", raw));
      continue;
    }
    // .NET / Java frame without a file location: "at Namespace.Type.Method()"
    match = line.match(/^at ([\w$.<>`+/]+\(.*\))$/);
    if (match) {
      language ||= "dotnet";
      frames.push(frame(match[1], "", "", "", raw));
      continue;
    }
    // Go: "pkg.Func(args)" followed by "\t/path/file.go:123 +0x1d"
    const next = lines[index + 1];
    const goLocation = next?.match(/^\s+(.+\.go):(\d+)(?: \+0x[0-9a-f]+)?$/);
    if (goLocation && /^[\w./*()-]+\(.*\)$/.test(line)) {
      language ||= "go";
      frames.push(frame(line.replace(/\(.*\)$/, ""), goLocation[1], goLocation[2], "", raw + "\n" + next));
      index += 1;
      continue;
    }
    headers.push(line);
  }

  return { language, frames, headers };
}

function frame(fn, file, line, column, raw) {
  return {
    fn: (fn || "").trim(),
    file: (file || "").trim(),
    line: line ? Number(line) : null,
    column: column ? Number(column) : null,
    code: "",
    inApp: isInApp(file || "", fn || ""),
    raw,
  };
}

/** Library and runtime frames are collapsed by default so the app's own code stands out. */
function isInApp(file, fn) {
  return !(
    /node_modules|site-packages|dist-packages|\/usr\/lib\/|\/usr\/local\/lib\/|\/lib\/python\d|vendor\//.test(file) ||
    /^(node:|internal\/|<anonymous>|native)/.test(file) ||
    /\/go\/src\/|\/pkg\/mod\/|GOROOT|runtime\/[a-z_]+\.go$/.test(file) ||
    /^(java|javax|jdk|sun|kotlin|kotlinx|android|System|Microsoft)\./.test(fn)
  );
}
