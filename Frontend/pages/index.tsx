import Desktop from "../components/Desktop/Desktop";
import TaskBar from "../components/TaskBar/TaskBar";

function Index() {
  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    >
      <Desktop />
      <TaskBar />
    </div>
  );
}

export default Index;
