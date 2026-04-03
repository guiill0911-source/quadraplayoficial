import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import SuspensaoBanner from "./SuspensaoBanner";
import bg from "../assets/quadra-play-bg.png";

type UserData = {
  nome?: string;
  role?: string;
};

function normalizeRole(role: any) {
  return role ? String(role).trim().toLowerCase() : "";
}

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setUserData(null);
          setLoading(false);
          return;
        }

        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          setUserData(snap.data() as UserData);
        } else {
          setUserData({
            nome: user.displayName || "Usuário",
            role: "atleta",
          });
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  if (loading) return null;

  const role = normalizeRole(userData?.role);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const mostrarBottomNav = role === "atleta" || role === "dono";
  const nomeMenuReservas =
  role === "dono"
    ? "Marcadas"
    : "Reservas";

  return (
    <>
      <header style={styles.header}>
        <div
          style={{
            ...styles.bgImage,
            backgroundImage: `url(${bg})`,
          }}
        />
        <div style={styles.overlay} />

        <div style={styles.inner}>
          <div style={styles.left}>
            <Link to="/" style={styles.logoWrap}>
              <span style={styles.logoBadge}>QP</span>

              <div>
                <span style={styles.logo}>Quadra Play</span>
                <div style={styles.tagline}>O seu jogo começa aqui</div>
              </div>
            </Link>
          </div>

          <div style={styles.right}>
            {role === "dono" ? (
              <>
                <Link
                  to="/dono"
                  style={{
                    ...styles.link,
                    ...(isActive("/dono") ? styles.linkActive : {}),
                  }}
                >
                  Painel
                </Link>

                <Link
                  to="/dono/central"
                  style={{
                    ...styles.link,
                    ...(isActive("/dono/central") ? styles.linkActive : {}),
                  }}
                >
                  Central
                </Link>

                <Link
                  to="/nova-quadra"
                  style={{
                    ...styles.link,
                    ...(isActive("/nova-quadra") ? styles.linkActive : {}),
                  }}
                >
                  Nova Quadra
                </Link>
              </>
            ) : null}

            {role === "ceo" ? (
              <div style={styles.ceoGroup}>
                <Link
                  to="/ceo"
                  style={{
                    ...styles.ceoLink,
                    ...(isActive("/ceo") &&
                    !isActive("/ceo/financeiro") &&
                    !isActive("/ceo/quadras")
                      ? styles.ceoLinkActive
                      : {}),
                  }}
                >
                  Dashboard CEO
                </Link>

                <Link
                  to="/ceo/financeiro"
                  style={{
                    ...styles.ceoLink,
                    ...(isActive("/ceo/financeiro") ? styles.ceoLinkActive : {}),
                  }}
                >
                  Financeiro CEO
                </Link>

                <Link
                  to="/ceo/quadras"
                  style={{
                    ...styles.ceoLink,
                    ...(isActive("/ceo/quadras") ? styles.ceoLinkActive : {}),
                  }}
                >
                  Quadras do app
                </Link>
              </div>
            ) : null}

            {userData ? (
              <span style={styles.user}>Olá, {userData.nome || "Usuário"}</span>
            ) : null}

            {userData ? (
              <button onClick={handleLogout} style={styles.logout}>
                Sair
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <SuspensaoBanner />

      {mostrarBottomNav ? (
        <nav style={styles.bottomNav}>
          <Link
            to="/"
            style={{
              ...styles.bottomItem,
              ...(isActive("/") ? styles.bottomItemActive : {}),
            }}
          >
            <span style={styles.bottomIcon}>⌂</span>
            <span style={styles.bottomText}>Home</span>
          </Link>

          <Link
            to={role === "dono" ? "/dono/reservas" : "/minhas-reservas"}
            style={{
              ...styles.bottomItem,
              ...(isActive("/minhas-reservas") ? styles.bottomItemActive : {}),
            }}
          >
            <span style={styles.bottomIcon}>◷</span>
            <span style={styles.bottomText}>{nomeMenuReservas}</span>
          </Link>

          <Link
            to="/perfil"
            style={{
              ...styles.bottomItem,
              ...(isActive("/perfil") ? styles.bottomItemActive : {}),
            }}
          >
            <span style={styles.bottomIcon}>◎</span>
            <span style={styles.bottomText}>Perfil</span>
          </Link>
        </nav>
      ) : null}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    position: "relative",
    width: "100%",
    borderBottom: "1px solid #1e293b",
    overflow: "hidden",
  },

  bgImage: {
    position: "absolute",
    inset: 0,
    backgroundSize: "cover",
    backgroundPosition: "center",
    opacity: 0.25,
  },

  overlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(2,6,23,0.75) 0%, rgba(2,6,23,0.9) 100%)",
  },

  inner: {
    position: "relative",
    zIndex: 2,
    maxWidth: "1280px",
    margin: "0 auto",
    padding: "20px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },

  left: {
    display: "flex",
    alignItems: "center",
  },

  right: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    textDecoration: "none",
  },

  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #2563eb, #0f172a)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 14,
  },

  logo: {
    fontWeight: 900,
    fontSize: 26,
    color: "#fff",
  },

  tagline: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },

  link: {
    textDecoration: "none",
    color: "#e2e8f0",
    fontSize: "14px",
    fontWeight: 800,
    padding: "8px 10px",
    borderRadius: "10px",
    transition: "all 0.18s ease",
  },

  linkActive: {
    background: "rgba(255,255,255,0.10)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.14)",
  },

  ceoGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    padding: "6px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.12)",
  },

  ceoLink: {
    textDecoration: "none",
    color: "#e2e8f0",
    fontSize: "14px",
    fontWeight: 900,
    padding: "10px 12px",
    borderRadius: "12px",
    transition: "all 0.18s ease",
    whiteSpace: "nowrap",
  },

  ceoLinkActive: {
    background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
    color: "#fff",
    boxShadow: "0 10px 20px rgba(29, 78, 216, 0.18)",
  },

  user: {
    color: "#e2e8f0",
    fontWeight: 700,
    fontSize: 14,
  },

  logout: {
    background: "#22c55e",
    color: "#022c22",
    border: "none",
    padding: "8px 12px",
    borderRadius: 10,
    fontWeight: 800,
    cursor: "pointer",
  },

  bottomNav: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1200,
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
    background: "rgba(15, 23, 42, 0.78)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 -10px 28px rgba(15,23,42,0.22)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
  },

  bottomItem: {
    minHeight: 58,
    borderRadius: 16,
    textDecoration: "none",
    color: "#cbd5e1",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    fontWeight: 800,
    fontSize: 12,
    transition: "all 0.18s ease",
  },

  bottomItemActive: {
    background: "rgba(37, 99, 235, 0.22)",
    color: "#fff",
    boxShadow: "inset 0 0 0 1px rgba(96, 165, 250, 0.22)",
  },

  bottomIcon: {
    fontSize: 18,
    lineHeight: 1,
  },

  bottomText: {
    fontSize: 12,
    fontWeight: 800,
  },
};