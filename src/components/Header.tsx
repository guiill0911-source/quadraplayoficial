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
  const nomeMenuReservas = role === "dono" ? "Marcadas" : "Reservas";

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
            <Link to="/home" style={styles.logoWrap}>
              <span style={styles.logoBadge}>QP</span>

              <div style={styles.logoTextWrap}>
                <span style={styles.logo}>Quadra Play</span>
                <div style={styles.tagline}>Seu jogo começa aqui</div>
              </div>
            </Link>
          </div>

          <div style={styles.right}>
            {role === "dono" && (
              <div style={styles.ownerMenu}>
                <Link
                  to="/dono"
                  style={{
                    ...styles.ownerLink,
                    ...(isActive("/dono") ? styles.ownerLinkActive : {}),
                  }}
                >
                  Painel
                </Link>

                <Link
                  to="/dono/central"
                  style={{
                    ...styles.ownerLink,
                    ...(isActive("/dono/central") ? styles.ownerLinkActive : {}),
                  }}
                >
                  Central
                </Link>

                <Link
                  to="/nova-quadra"
                  style={{
                    ...styles.ownerLink,
                    ...(isActive("/nova-quadra") ? styles.ownerLinkActive : {}),
                  }}
                >
                  Nova
                </Link>
              </div>
            )}

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

      {false && <SuspensaoBanner />}

      {mostrarBottomNav ? (
        <nav style={styles.bottomNav}>
          <Link
            to="/home"
            style={{
              ...styles.bottomItem,
              ...(isActive("/home") ? styles.bottomItemActive : {}),
            }}
          >
            <span style={styles.bottomIcon}>⌂</span>
            <span style={styles.bottomText}>Home</span>
          </Link>

          <Link
            to={role === "dono" ? "/dono/reservas" : "/minhas-reservas"}
            style={{
              ...styles.bottomItem,
              ...((role === "dono"
                ? isActive("/dono/reservas")
                : isActive("/minhas-reservas"))
                ? styles.bottomItemActive
                : {}),
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
    borderBottom: "1px solid rgba(30, 41, 59, 0.8)",
    overflowX: "hidden"
  },

  bgImage: {
    position: "absolute",
    inset: 0,
    backgroundSize: "cover",
    backgroundPosition: "center",
    opacity: 0.12,
  },

  overlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(2,6,23,0.88) 0%, rgba(2,6,23,0.96) 100%)",
  },

  inner: {
    position: "relative",
    zIndex: 2,
    maxWidth: "1280px",
    margin: "0 auto",
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  left: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    flexShrink: 0,
  },

  right: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    marginLeft: "auto",
  },

  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
    minWidth: 0,
  },

  logoTextWrap: {
    minWidth: 0,
  },

  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #2563eb, #0f172a)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 11,
    flexShrink: 0,
  },

  logo: {
    fontWeight: 900,
    fontSize: 17,
    color: "#f8fafc",
    letterSpacing: -0.3,
    lineHeight: 1.05,
    display: "block",
  },

  tagline: {
    fontSize: 10,
    color: "#60a5fa",
    marginTop: 2,
    lineHeight: 1.1,
  },

  ownerMenu: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },

  ownerLink: {
    textDecoration: "none",
    color: "#ecfdf5",
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 10,
    lineHeight: 1.1,
    background: "linear-gradient(135deg, rgba(22,163,74,0.24), rgba(34,197,94,0.18))",
    border: "1px solid rgba(74, 222, 128, 0.28)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
    transition: "all 0.18s ease",
  },

  ownerLinkActive: {
    background: "linear-gradient(135deg, rgba(22,163,74,0.42), rgba(34,197,94,0.30))",
    color: "#ffffff",
    border: "1px solid rgba(134, 239, 172, 0.42)",
  },

  user: {
    color: "#dbeafe",
    fontWeight: 700,
    fontSize: 12,
    lineHeight: 1.1,
    padding: "0 2px",
    whiteSpace: "nowrap",
  },

  logout: {
    background: "linear-gradient(135deg, #ef4444, #dc2626)",
    color: "#fff",
    border: "none",
    padding: "6px 11px",
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    lineHeight: 1.1,
    boxShadow: "0 8px 18px rgba(220,38,38,0.20)",
  },

 bottomNav: {
  position: "fixed",
  left: 12,
  right: 12,
  bottom: 8,
  zIndex: 9999,
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 6,
  padding: "5px 6px calc(5px + env(safe-area-inset-bottom))",
  background: "rgba(15, 23, 42, 0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  backdropFilter: "blur(14px)",
  boxShadow: "0 6px 16px rgba(2,6,23,0.16)",
  pointerEvents: "none",
  maxWidth: 360,
  margin: "0 auto",
},

 bottomItem: {
  minHeight: 34,
  borderRadius: 10,
  textDecoration: "none",
  color: "#cbd5e1",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 1,
  fontWeight: 700,
  fontSize: 9,
  lineHeight: 1,
  pointerEvents: "auto",
  padding: "2px 4px",
},

  bottomItemActive: {
    background: "rgba(37, 99, 235, 0.20)",
    color: "#ffffff",
  },

  bottomIcon: {
  fontSize: 12,
  lineHeight: 1,
},

bottomText: {
  fontSize: 9,
  lineHeight: 1,
},
};