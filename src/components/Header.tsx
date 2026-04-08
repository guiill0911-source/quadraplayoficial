import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import SuspensaoBanner from "./SuspensaoBanner";
import bg from "../assets/quadra-play-bg.png";
import logo from "../assets/logo.png";

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
  <img src={logo} alt="" style={styles.logoImage} />
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

            {userData && (
              <span style={styles.user}>
                Olá, {userData.nome || "Usuário"}
              </span>
            )}

            {userData && (
              <button onClick={handleLogout} style={styles.logout}>
                Sair
              </button>
            )}
          </div>
        </div>
      </header>

      {false && <SuspensaoBanner />}

      {mostrarBottomNav && (
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
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    position: "relative",
    width: "100%",
    borderBottom: "1px solid rgba(138, 232, 9, 0.18)",
    overflowX: "hidden",
    background: "#03122e",
  },

  bgImage: {
    position: "absolute",
    inset: 0,
    backgroundSize: "cover",
    backgroundPosition: "center",
    opacity: 0.06,
  },

  overlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(3,18,46,0.96) 0%, rgba(3,18,46,0.98) 100%)",
  },

  inner: {
  position: "relative",
  zIndex: 2,
  maxWidth: "1280px",
  margin: "0 auto",
  padding: "8px 12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  flexWrap: "nowrap",
  minHeight: 64,
},

  left: {
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
},

  right: {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginLeft: "auto",
  flexWrap: "nowrap",
},

  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
  },

  logoImage: {
  height: 52,
  width: "auto",
  display: "block",
  objectFit: "contain",
},

  logoTextWrap: {},

  logo: {
    fontWeight: 900,
    fontSize: 16,
    color: "#ffffff",
  },

  tagline: {
    fontSize: 10,
    color: "#8ae809",
    fontWeight: 700,
  },

  ownerMenu: {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginRight: 4,
},

  ownerLink: {
  textDecoration: "none",
  color: "#ffffff",
  fontSize: 10,
  fontWeight: 800,
  padding: "5px 8px",
  borderRadius: 9,
  background: "rgba(138,232,9,0.10)",
  border: "1px solid rgba(138,232,9,0.22)",
  lineHeight: 1,
  whiteSpace: "nowrap",
},

  ownerLinkActive: {
    background: "#8ae809",
    color: "#03122e",
  },

  user: {
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 11,
  whiteSpace: "nowrap",
  marginLeft: 2,
},

  logout: {
  background: "#8ae809",
  color: "#03122e",
  border: "none",
  padding: "5px 9px",
  borderRadius: 9,
  fontWeight: 800,
  fontSize: 10,
  cursor: "pointer",
  lineHeight: 1,
  whiteSpace: "nowrap",
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
    padding: "5px",
    background: "rgba(3,18,46,0.96)",
    borderRadius: 14,
  },

  bottomItem: {
    textDecoration: "none",
    color: "rgba(255,255,255,0.7)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    fontSize: 10,
  },

  bottomItemActive: {
    color: "#8ae809",
  },

  bottomIcon: {
    fontSize: 14,
  },

  bottomText: {
    fontSize: 10,
  },
};