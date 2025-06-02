// import React from "react"; // Removed - not needed with new JSX transform
// import "./App.css"; // Removed
import MasonryWall from "./components/MasonryWall";
import styled, { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    font-family: system-ui, Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: #242424; 
    color: rgba(255, 255, 255, 0.87);
    overflow-x: hidden; // Prevent horizontal scrollbars from minor layout issues
  }

  #root {
    height: 100vh;
    width: 100vw;
    margin: 0;
    padding: 0;
    display: flex; // Ensure #root takes full space and allows flex children
  }

  * {
    box-sizing: border-box;
  }
`;

const AppWrapper = styled.div`
  height: 100%;
  width: 100%;
  display: flex; // Ensure MasonryWall (as a child) can also flex if needed
`;

function App() {
  return (
    <>
      <GlobalStyle />
      <AppWrapper>
        {/* The H1 title is now moved into MasonryWall's WallColumn for better layout control */}
        <MasonryWall />
      </AppWrapper>
    </>
  );
}

export default App;
