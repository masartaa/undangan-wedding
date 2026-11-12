import { pbkdf2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const PBKDF2_ITERATIONS = 600000;
const PASSWORD_HASH_LENGTH = 32;
const derivePasswordHash = promisify(pbkdf2);

const readSecret = (prompt) =>
  new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new Error("Jalankan skrip ini dari terminal interaktif agar kata sandi tidak tampil."));
      return;
    }

    let value = "";
    const finish = (error) => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };
    const onData = (chunk) => {
      const input = chunk.toString("utf8");
      if (input === "\u0003") {
        finish(new Error("Pembuatan admin dibatalkan."));
      } else if (input.includes("\r") || input.includes("\n")) {
        finish();
      } else if (input === "\u007f" || input === "\b") {
        value = Array.from(value).slice(0, -1).join("");
      } else if (input === "\u0015") {
        value = "";
      } else if (!input.includes("\u001b")) {
        value += input;
      }
    };

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });

const main = async () => {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const secretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secretKey) {
    throw new Error("SUPABASE_URL dan SUPABASE_SECRET_KEY harus tersedia.");
  }
  new URL(supabaseUrl);

  const input = readline.createInterface({ input: stdin, output: stdout });
  const username = (await input.question("Username admin: ")).trim();
  input.close();
  if (!/^[A-Za-z0-9._-]{3,80}$/.test(username)) {
    throw new Error("Username harus 3-80 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.");
  }

  const password = await readSecret("Kata sandi (12-128 karakter): ");
  const confirmation = await readSecret("Ulangi kata sandi: ");
  if (password.length < 12 || password.length > 128 || password !== confirmation) {
    throw new Error("Kata sandi harus 12-128 karakter dan kedua isian harus sama.");
  }

  const salt = randomBytes(16);
  const hash = await derivePasswordHash(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PASSWORD_HASH_LENGTH,
    "sha256"
  );
  const response = await fetch(`${supabaseUrl}/rest/v1/admin?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({
      id: 1,
      username,
      password_hash: hash.toString("base64"),
      salt: salt.toString("base64")
    })
  });

  if (!response.ok) {
    console.error("Supabase menolak penyimpanan akun admin.", { status: response.status });
    throw new Error("Akun admin belum dapat disimpan.");
  }

  console.log("Akun admin berhasil dibuat atau diperbarui.");
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
