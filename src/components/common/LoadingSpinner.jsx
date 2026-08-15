export default function LoadingSpinner() {
  return (
    <div
      style={{
        width: "40px",
        height: "40px",
        border: "4px solid #d8ddc8",
        borderTopColor: "#1c555a",
        borderRadius: "50%",
        animation: "carefur-spin 0.8s linear infinite",
      }}
      aria-label="Loading"
      role="status"
    >
      <style>
        {`
          @keyframes carefur-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
}