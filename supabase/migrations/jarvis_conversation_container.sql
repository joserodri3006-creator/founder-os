-- web_search fuehrt intern Code-Ausfuehrung in einem Sandbox-Container aus. Enthaelt die
-- gespeicherte Nachrichten-Historie einer Konversation noch unaufgeloeste Code-Execution-
-- Bloecke (z.B. nach einer Recherche), muss bei jedem Folge-Request dieselbe Container-ID
-- mitgegeben werden — sonst: "container_id is required when there are pending tool uses...".
-- Da Konversationen ueber mehrere HTTP-Requests laufen, muss die Container-ID pro
-- Konversation persistiert werden, nicht nur innerhalb eines einzelnen Turns.

alter table jarvis_conversations
  add column if not exists container_id text;
