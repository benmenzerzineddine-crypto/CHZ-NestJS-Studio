import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, TabList, Tab, TabPanel } from "./tabs";

describe("Tabs component with HeroUI v3", () => {
  it("renders tabs and switches active panel on click", () => {
    render(
      <Tabs defaultSelectedKey="tab1" aria-label="Demo Tabs">
        <TabList aria-label="Tab list">
          <Tab id="tab1">First Tab</Tab>
          <Tab id="tab2">Second Tab</Tab>
        </TabList>
        <TabPanel id="tab1">Content One</TabPanel>
        <TabPanel id="tab2">Content Two</TabPanel>
      </Tabs>,
    );

    expect(screen.getByText("Content One")).toBeInTheDocument();
    expect(screen.queryByText("Content Two")).not.toBeInTheDocument();

    const secondTab = screen.getByRole("tab", { name: "Second Tab" });
    fireEvent.click(secondTab);

    expect(screen.getByText("Content Two")).toBeInTheDocument();
  });
});
