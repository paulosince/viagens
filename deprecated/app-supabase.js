const SUPABASE_URL = "https://siabldasqinpfmxslwji.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UgbBIOq1TnInuPRrQpAFag_JLIzYuFf";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let mode = "login";
const authCard = document.querySelector("#auth-card");
const dashboard = document.querySelector("#dashboard");
const form = document.querySelector("#auth-form");
const message = document.querySelector("#message");
const submitButton = document.querySelector("#submit-button");
const tripGrid = document.querySelector("#trip-grid");
const welcome = document.querySelector("#welcome");

function showMessage(text = "", error = true) {
  message.textContent = text;
  message.style.color = error ? "#9a4d3f" : "#4d7557";
}
function setMode(next) {
  mode = next;
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));
  submitButton.textContent = mode === "login" ? "Entrar" : "Criar conta";
  showMessage("");
}
function showAuth() {
  dashboard.classList.add("hidden");
  authCard.classList.remove("hidden");
}
function renderTrips(trips) {
  if (!trips.length) {
    tripGrid.innerHTML = "<p class='hint'>Você ainda não tem viagens cadastradas.</p>";
    return;
  }
  tripGrid.innerHTML = trips.map(trip =>
    "<article class='trip'><h3>" + escapeHtml(trip.name) + "</h3><p>" + escapeHtml(trip.detail || "") + "</p><p>" + escapeHtml(trip.status || "") + "</p></article>"
  ).join("");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
async function loadDashboard(user) {
  const result = await client.from("trips").select("id,name,detail,status").order("created_at", { ascending: true });
  if (result.error) throw result.error;
  welcome.textContent = "Olá, " + user.email.split("@")[0];
  renderTrips(result.data || []);
  authCard.classList.add("hidden");
  dashboard.classList.remove("hidden");
}
async function refreshSession() {
  const result = await client.auth.getSession();
  const session = result.data.session;
  if (session && session.user) {
    try { await loadDashboard(session.user); } catch (error) { showMessage(error.message); }
  }
}

document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
form.addEventListener("submit", async event => {
  event.preventDefault();
  submitButton.disabled = true;
  showMessage("Aguarde…", false);
  const email = document.querySelector("#email").value.trim().toLowerCase();
  const password = document.querySelector("#password").value;
  const result = mode === "login"
    ? await client.auth.signInWithPassword({ email, password })
    : await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
  submitButton.disabled = false;
  if (result.error) return showMessage(result.error.message);
  if (mode === "signup" && !result.data.session) return showMessage("Conta criada. Confirme seu e-mail para poder entrar.", false);
  try { await loadDashboard(result.data.user); form.reset(); } catch (error) { showMessage(error.message); }
});
document.querySelector("#logout").addEventListener("click", async () => {
  await client.auth.signOut();
  showAuth();
  form.reset();
});
document.querySelector("#new-trip").addEventListener("click", async () => {
  const name = prompt("Nome da viagem:");
  if (!name || !name.trim()) return;
  const result = await client.from("trips").insert({ name: name.trim(), detail: "Nova viagem", status: "Ainda sem roteiro" });
  if (result.error) return showMessage(result.error.message);
  const userResult = await client.auth.getUser();
  await loadDashboard(userResult.data.user);
});
client.auth.onAuthStateChange((_event, session) => { if (!session) showAuth(); });
refreshSession();
