const STORAGE_KEY = "viagens-prototipo-contas";
const SESSION_KEY = "viagens-prototipo-sessao";
const seed = {
  "familia@exemplo.com": {
    password: "familia123",
    name: "Família",
    trips: [{ name: "Lisboa e Paris", detail: "Novembro de 2026 · 5 viajantes", status: "Roteiro em andamento" }]
  }
};
let mode = "login";
const accounts = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || seed;
const authCard = document.querySelector("#auth-card");
const dashboard = document.querySelector("#dashboard");
const form = document.querySelector("#auth-form");
const message = document.querySelector("#message");
const submitButton = document.querySelector("#submit-button");

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts)); }
function showMessage(text = "") { message.textContent = text; }
function setMode(next) {
  mode = next;
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));
  submitButton.textContent = mode === "login" ? "Entrar" : "Criar conta";
  showMessage("");
}
function render(email) {
  const account = accounts[email];
  document.querySelector("#welcome").textContent = `Olá, ${account.name}`;
  document.querySelector("#trip-grid").innerHTML = account.trips.map(trip => `
    <article class="trip"><h3>${trip.name}</h3><p>${trip.detail}</p><p>${trip.status}</p></article>
  `).join("");
  authCard.classList.add("hidden");
  dashboard.classList.remove("hidden");
}
function logout() {
  localStorage.removeItem(SESSION_KEY);
  dashboard.classList.add("hidden");
  authCard.classList.remove("hidden");
  form.reset();
}
document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
form.addEventListener("submit", event => {
  event.preventDefault();
  const email = document.querySelector("#email").value.trim().toLowerCase();
  const password = document.querySelector("#password").value;
  if (mode === "login") {
    if (!accounts[email] || accounts[email].password !== password) return showMessage("E-mail ou senha inválidos.");
    localStorage.setItem(SESSION_KEY, email);
    render(email);
    return;
  }
  if (accounts[email]) return showMessage("Já existe uma conta com este e-mail.");
  if (password.length < 6) return showMessage("Use uma senha com pelo menos 6 caracteres.");
  accounts[email] = { password, name: email.split("@")[0], trips: [] };
  save();
  localStorage.setItem(SESSION_KEY, email);
  render(email);
});
document.querySelector("#logout").addEventListener("click", logout);
document.querySelector("#new-trip").addEventListener("click", () => {
  const email = localStorage.getItem(SESSION_KEY);
  const name = prompt("Nome da viagem:");
  if (!name) return;
  accounts[email].trips.push({ name, detail: "Nova viagem", status: "Ainda sem roteiro" });
  save();
  render(email);
});
const session = localStorage.getItem(SESSION_KEY);
if (session && accounts[session]) render(session);
