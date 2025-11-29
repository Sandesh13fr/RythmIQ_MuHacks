import React from "react";

const MainLayout = ({ children }) => {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-6 sm:pb-8 md:pb-12 max-w-7xl">
      {children}
    </div>
  );
};

export default MainLayout;