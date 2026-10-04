// Bolhas flutuando ao fundo (mesma ideia do AldenOS: #particles + .bub)
export function iniciarFundo() {
  const caixa = document.getElementById("particles");
  if (!caixa || caixa.childElementCount) return;

  const pequeno = window.matchMedia("(max-width: 700px)").matches;
  const total = pequeno ? 9 : 18;

  for (let i = 0; i < total; i++) {
    const b = document.createElement("span");
    b.className = "bub";
    const tamanho = 24 + Math.random() * 80;
    b.style.width = b.style.height = `${tamanho}px`;
    b.style.left = `${Math.random() * 100}%`;
    b.style.setProperty("--dur", `${14 + Math.random() * 16}s`);
    b.style.setProperty("--delay", `${-Math.random() * 30}s`);
    b.style.setProperty("--drift", `${Math.round(Math.random() * 120 - 60)}px`);
    caixa.appendChild(b);
  }
}
