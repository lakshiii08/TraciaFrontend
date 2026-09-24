// Node 22+ built-in SQLite API.
// @ts-expect-error node:sqlite is available at runtime on Node 22+, while this project keeps @types/node 20 for compatibility.
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
const dbPath=path.join(process.cwd(),"data","tracia.db");
function db(){fs.mkdirSync(path.dirname(dbPath),{recursive:true});const d=new DatabaseSync(dbPath);d.exec("CREATE TABLE IF NOT EXISTS users (operator_id TEXT PRIMARY KEY, password_hash TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)");const count=d.prepare("SELECT COUNT(*) AS count FROM users").get() as {count:number};if(Number(count.count)===0){for(const [id,role] of [["TRACIA-ADMIN","Admin"],["INVESTIGATOR-01","Investigator"],["ANALYST-01","Analyst"],["AUDITOR-01","Auditor"]]){const salt=randomBytes(16).toString("hex");const hash=scryptSync("TRACIA-2026",salt,64).toString("hex");d.prepare("INSERT INTO users(operator_id,password_hash,role) VALUES(?,?,?)").run(id,`${salt}:${hash}`,role)}}return d}
export function authenticate(operatorId:string,password:string){const d=db();const row=d.prepare("SELECT operator_id, password_hash, role FROM users WHERE operator_id = ? AND active = 1").get(operatorId) as {operator_id:string,password_hash:string,role:string}|undefined;try{d.close()}catch{}if(!row)return null;const [salt,stored]=row.password_hash.split(":");const actual=scryptSync(password,salt,64);const expected=Buffer.from(stored,"hex");if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;return {operatorId:row.operator_id,role:row.role}}
