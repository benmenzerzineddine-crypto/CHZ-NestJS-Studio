import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createProject } from "@/core/model/defaults";
import { useProjectStore } from "@/store/project.store";
import { SettingsScreen } from "./SettingsScreen";

describe("SettingsScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useProjectStore.setState({
      project: null,
      status: "idle",
      revision: 0,
      lastSavedAt: null,
      error: null,
    });
  });

  it("toggles file uploads and configures storage driver", () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);

    render(<SettingsScreen />);
    expect(screen.getByText("File Uploads")).toBeInTheDocument();

    const toggle = screen.getByLabelText("Attachments");
    expect(toggle).not.toBeChecked();

    // Toggle on
    fireEvent.click(toggle);
    expect(useProjectStore.getState().project?.settings.uploads.enabled).toBe(true);

    // Driver selector should now be visible
    const driverSelect = screen.getByLabelText("Storage driver");
    expect(driverSelect).toHaveValue("local");

    fireEvent.change(driverSelect, { target: { value: "s3" } });
    expect(useProjectStore.getState().project?.settings.uploads.driver).toBe("s3");

    // Max file size
    const sizeInput = screen.getByLabelText("Max file size (MB)");
    expect(sizeInput).toHaveValue(10);

    fireEvent.change(sizeInput, { target: { value: "50" } });
    expect(useProjectStore.getState().project?.settings.uploads.maxFileSizeMb).toBe(50);
  });

  it("toggles multi-tenancy and configures tenant header", () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);

    render(<SettingsScreen />);
    expect(screen.getByText("Multi-tenancy")).toBeInTheDocument();

    const toggle = screen.getByLabelText("Enable Multi-tenancy");
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(useProjectStore.getState().project?.settings.multitenancy.enabled).toBe(true);

    const headerInput = screen.getByLabelText("Tenant header");
    expect(headerInput).toHaveValue("x-tenant-id");

    fireEvent.change(headerInput, { target: { value: "x-org-id" } });
    expect(useProjectStore.getState().project?.settings.multitenancy.header).toBe("x-org-id");
  });

  it("configures global rate limiting settings", () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);

    render(<SettingsScreen />);
    expect(screen.getByText("Rate Limiting")).toBeInTheDocument();

    const toggle = screen.getByLabelText("Enable rate limiting");
    expect(toggle).toBeChecked();

    const ttlInput = screen.getByLabelText("Time-to-live (seconds)");
    expect(ttlInput).toHaveValue(60);

    const limitInput = screen.getByLabelText("Request limit");
    expect(limitInput).toHaveValue(100);

    fireEvent.change(ttlInput, { target: { value: "120" } });
    expect(useProjectStore.getState().project?.settings.throttling.ttl).toBe(120);

    fireEvent.change(limitInput, { target: { value: "500" } });
    expect(useProjectStore.getState().project?.settings.throttling.limit).toBe(500);

    fireEvent.click(toggle);
    expect(useProjectStore.getState().project?.settings.throttling.enabled).toBe(false);
  });

  it("toggles GraphQL API and configures playground and path", () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);

    render(<SettingsScreen />);
    expect(screen.getByText("GraphQL API")).toBeInTheDocument();

    const toggle = screen.getByLabelText("GraphQL");
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(useProjectStore.getState().project?.settings.graphql.enabled).toBe(true);

    const playgroundToggle = screen.getByLabelText("Playground");
    expect(playgroundToggle).toBeChecked();

    fireEvent.click(playgroundToggle);
    expect(useProjectStore.getState().project?.settings.graphql.playground).toBe(false);

    const pathInput = screen.getByLabelText("GraphQL path");
    expect(pathInput).toHaveValue("/graphql");

    fireEvent.change(pathInput, { target: { value: "/custom-graphql" } });
    expect(useProjectStore.getState().project?.settings.graphql.path).toBe("/custom-graphql");

    fireEvent.click(toggle);
    expect(useProjectStore.getState().project?.settings.graphql.enabled).toBe(false);
  });

  it("updates general project settings and sanitizes package name", () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);

    render(<SettingsScreen />);
    expect(screen.getByText("General")).toBeInTheDocument();

    const nameInput = screen.getByLabelText("Project name");
    expect(nameInput).toHaveValue("Blog API");
    fireEvent.change(nameInput, { target: { value: "Updated API" } });
    expect(useProjectStore.getState().project?.name).toBe("Updated API");

    // Clear and blur should fallback to "Untitled API"
    fireEvent.change(nameInput, { target: { value: "   " } });
    fireEvent.blur(nameInput);
    expect(useProjectStore.getState().project?.name).toBe("Untitled API");

    const packageInput = screen.getByLabelText("Package name");
    fireEvent.change(packageInput, { target: { value: "My @ Special _ Package!" } });
    expect(useProjectStore.getState().project?.packageName).toBe("my---special---package-");

    // Clear and blur should fallback to "my-api"
    fireEvent.change(packageInput, { target: { value: "" } });
    fireEvent.blur(packageInput);
    expect(useProjectStore.getState().project?.packageName).toBe("my-api");
  });

  it("updates database driver, api prefix, tooling and auth toggles", () => {
    const project = createProject("Blog API");
    useProjectStore.getState().openProject(project);

    render(<SettingsScreen />);

    // Database driver
    const driverSelect = screen.getByLabelText("Driver");
    expect(driverSelect).toHaveValue("postgres");
    fireEvent.change(driverSelect, { target: { value: "mysql" } });
    expect(useProjectStore.getState().project?.driver).toBe("mysql");

    // API prefix
    const prefixInput = screen.getByLabelText("API prefix");
    expect(prefixInput).toHaveValue("api");
    fireEvent.change(prefixInput, { target: { value: "v1/api" } });
    expect(useProjectStore.getState().project?.settings.apiPrefix).toBe("v1-api");

    fireEvent.change(prefixInput, { target: { value: "" } });
    fireEvent.blur(prefixInput);
    expect(useProjectStore.getState().project?.settings.apiPrefix).toBe("api");

    // Swagger
    const swaggerToggle = screen.getByLabelText("Swagger");
    expect(swaggerToggle).toBeChecked();
    fireEvent.click(swaggerToggle);
    expect(useProjectStore.getState().project?.settings.swagger).toBe(false);

    // Docker
    const dockerToggle = screen.getByLabelText("Docker");
    expect(dockerToggle).toBeChecked();
    fireEvent.click(dockerToggle);
    expect(useProjectStore.getState().project?.settings.docker).toBe(false);

    // Tests
    const testsToggle = screen.getByLabelText("Tests");
    expect(testsToggle).toBeChecked();
    fireEvent.click(testsToggle);
    expect(useProjectStore.getState().project?.settings.tests).toBe(false);

    // Auth Enabled
    const authToggle = screen.getByLabelText("Enabled");
    expect(authToggle).toBeChecked();
    fireEvent.click(authToggle);
    expect(useProjectStore.getState().project?.auth.enabled).toBe(false);
  });

  it("toggles background queues and adds/modifies queues and jobs", () => {
    const project = createProject("Queue API");
    useProjectStore.getState().openProject(project);

    render(<SettingsScreen />);
    expect(screen.getByText("Background Jobs & Queues (BullMQ)")).toBeInTheDocument();

    const toggle = screen.getByLabelText("Background Queues");
    expect(toggle).not.toBeChecked();

    // Enable queues
    fireEvent.click(toggle);
    expect(useProjectStore.getState().project?.settings.queues.enabled).toBe(true);

    // Default queue should be created
    expect(screen.getByDisplayValue("mail")).toBeInTheDocument();
    expect(screen.getByDisplayValue("sendWelcomeEmail")).toBeInTheDocument();

    // Edit redis host and port
    const hostInput = screen.getByLabelText("Redis host");
    fireEvent.change(hostInput, { target: { value: "redis-cluster" } });
    expect(useProjectStore.getState().project?.settings.queues.redisHost).toBe("redis-cluster");

    const portInput = screen.getByLabelText("Redis port");
    fireEvent.change(portInput, { target: { value: "6380" } });
    expect(useProjectStore.getState().project?.settings.queues.redisPort).toBe(6380);

    // Add a new queue
    const addQueueBtn = screen.getByRole("button", { name: /Add Queue/i });
    fireEvent.click(addQueueBtn);
    expect(useProjectStore.getState().project?.settings.queues.queues.length).toBe(2);

    // Add job to the first queue
    const addJobBtns = screen.getAllByRole("button", { name: /Add Job/i });
    fireEvent.click(addJobBtns[0]);
    expect(useProjectStore.getState().project?.settings.queues.queues[0].jobs.length).toBe(2);
  });

  it("toggles WebSockets and configures gateway path, CORS, and event toggles", () => {
    const project = createProject("Chat API");
    useProjectStore.getState().openProject(project);

    render(<SettingsScreen />);
    expect(screen.getByText("Real-Time WebSockets (Socket.IO)")).toBeInTheDocument();

    const toggle = screen.getByLabelText("WebSockets");
    expect(toggle).not.toBeChecked();

    // Enable WebSockets
    fireEvent.click(toggle);
    expect(useProjectStore.getState().project?.settings.websockets.enabled).toBe(true);

    const pathInput = screen.getByLabelText("Gateway path");
    expect(pathInput).toHaveValue("/events");
    fireEvent.change(pathInput, { target: { value: "/socket.io" } });
    expect(useProjectStore.getState().project?.settings.websockets.path).toBe("/socket.io");

    const corsInput = screen.getByLabelText("CORS origin");
    expect(corsInput).toHaveValue("*");
    fireEvent.change(corsInput, { target: { value: "https://myfrontend.com" } });
    expect(useProjectStore.getState().project?.settings.websockets.corsOrigin).toBe("https://myfrontend.com");

    const jwtToggle = screen.getByLabelText("JWT Authentication");
    expect(jwtToggle).toBeChecked();
    fireEvent.click(jwtToggle);
    expect(useProjectStore.getState().project?.settings.websockets.auth).toBe(false);

    const crudToggle = screen.getByLabelText("Broadcast CRUD Events");
    expect(crudToggle).toBeChecked();
    fireEvent.click(crudToggle);
    expect(useProjectStore.getState().project?.settings.websockets.broadcastCrud).toBe(false);

    // Disable WebSockets
    fireEvent.click(toggle);
    expect(useProjectStore.getState().project?.settings.websockets.enabled).toBe(false);
  });
});


