import log from "loglevel";
import prefix from "loglevel-plugin-prefix";

prefix.reg(log);
log.enableAll(); // 모든 로그 레벨 활성화

prefix.apply(log, {
  format(level, name, timestamp) {
    return `[백준허브]${name != null && name !== "root" ? `[${name}]` : ""}:`;
  },
});

export default log;
