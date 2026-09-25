var shell = WScript.CreateObject("WScript.Shell");
var runner = WScript.Arguments(0);

shell.Run(
  '"' + shell.ExpandEnvironmentStrings("%ComSpec%") + '" /d /c ""' + runner + '""',
  0,
  false
);