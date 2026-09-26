import { useEffect, useRef, useState } from "react";
import { IoPaw } from "react-icons/io5";
import "./LoadingScreen.css";

export default function LoadingScreen({ onFinish }) {
  const [pawCount, setPawCount] = useState(1);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      setVisible(true);
    });

    timerRef.current = setInterval(() => {
      setPawCount((current) => {
        if (current >= 10) {
          clearInterval(timerRef.current);

          setTimeout(() => {
            onFinish?.();
          }, 500);

          return 10;
        }

        return current + 1;
      });
    }, 220);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [onFinish]);

  return (
    <div className="splash-screen">
      <div
        className={`splash-logo-wrapper ${
          visible ? "splash-logo-visible" : ""
        }`}
      >
        <img
          src="/Logo.jpg"
          alt="Snuggles Premium Pet Hotel"
          className="splash-logo"
        />
      </div>

      <p className="splash-loading-text">
        Preparing your pet&apos;s stay...
      </p>

      <div className="splash-paws">
        {Array.from({ length: 10 }).map((_, index) => (
          <IoPaw
            key={index}
            size={18}
            color={index < pawCount ? "#14646B" : "#D8E7E6"}
          />
        ))}
      </div>

      <p className="splash-loading-number">
        {pawCount}/10
      </p>
    </div>
  );
}