import {
  Tabs as HeroUITabs,
  TabList as HeroUITabList,
  Tab as HeroUITab,
  TabPanel as HeroUITabPanel,
} from "@heroui/react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type TabsProps = ComponentProps<typeof HeroUITabs>;
export type TabListProps = ComponentProps<typeof HeroUITabList>;
export type TabProps = ComponentProps<typeof HeroUITab>;
export type TabPanelProps = ComponentProps<typeof HeroUITabPanel>;

export function Tabs({ className, ...props }: TabsProps) {
  return <HeroUITabs className={cn("w-full", className)} {...props} />;
}

export function TabList({ className, ...props }: TabListProps) {
  return <HeroUITabList className={cn("flex items-center gap-1", className)} {...props} />;
}

export function Tab({ className, ...props }: TabProps) {
  return <HeroUITab className={cn("cursor-pointer", className)} {...props} />;
}

export function TabPanel({ className, ...props }: TabPanelProps) {
  return <HeroUITabPanel className={cn("focus:outline-none", className)} {...props} />;
}

Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panel = TabPanel;
Tabs.Indicator = HeroUITabs.Indicator;
Tabs.Separator = HeroUITabs.Separator;

export { HeroUITabs, HeroUITabList, HeroUITab, HeroUITabPanel };
