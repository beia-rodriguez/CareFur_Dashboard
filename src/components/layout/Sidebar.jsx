import { NavLink } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import "./Sidebar.css";


const navigation = [
  {
    title: null,
    items: [
      {
        label: "Dashboard",
        to: "/dashboard",
      },
    ],
  },

  {
    title: "Operations",
    items: [
      {
        label: "New Boarding",
        to: "/boarding/new",
        primary: true,
      },
      {
        label: "Bookings",
        to: "/bookings",
      },
      {
        label: "Pets",
        to: "/pets",
      },
      {
        label: "Rooms",
        to: "/rooms",
      },
      {
        label: "Feeding Schedule",
        to: "/feeding-schedules",
      },
    ],
  },

  {
    title: "Monitoring",
    items: [
      {
        label: "Cameras",
        to: "/cameras",
      },
      {
        label: "Alerts",
        to: "/alerts",
      },
    ],
  },

  {
    title: "Management",
    items: [
      {
        label: "Staff Management",
        to: "/staff",
        adminOnly: true,
      },
    ],
  },

  {
    title: "System",
    items: [
      {
        label: "Notifications",
        to: "/notifications",
      },
    ],
  },
];


export default function Sidebar({
  isOpen,
  onClose,
}) {

  const {
    logout,
    profile,
    isAdmin,
  } = useAuth();


  async function handleLogout() {

    try {

      await logout();

    } catch (error) {

      console.error(
        "Logout failed:",
        error
      );

    }

  }


  return (

    <aside
      className={`sidebar ${
        isOpen ? "sidebar-open" : ""
      }`}
    >

      <div className="sidebar-header">

        <div>
          <strong>
            CareFur
          </strong>

          <p>
            {profile?.role || "staff"}
          </p>
        </div>


        <button
          type="button"
          className="sidebar-close"
          aria-label="Close navigation"
          onClick={onClose}
        >
          ×
        </button>

      </div>


      <nav className="sidebar-nav">

        {navigation.map((group) => (

          <div
            key={group.title || "main"}
            className="sidebar-group"
          >

            {group.title && (

              <p className="sidebar-group-title">
                {group.title}
              </p>

            )}


            {group.items.map((item) => {

              if (
                item.adminOnly &&
                !isAdmin
              ) {
                return null;
              }


              return (

                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    [
                      "sidebar-link",
                      item.primary &&
                        "sidebar-link-primary",
                      isActive &&
                        "sidebar-link-active",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  {item.label}
                </NavLink>

              );

            })}

          </div>

        ))}

      </nav>


      <button
        type="button"
        className="sidebar-logout"
        onClick={handleLogout}
      >
        Log out
      </button>


    </aside>

  );

}