export const mApi = {
  // 홈 화면 전체 데이터 한 번에
  home: () =>
    fetch("/api/m/home")
      .then((r) => r.json())
      .then((d) => d.data),

  families: () =>
    fetch("/api/families")
      .then((r) => r.json())
      .then((d) => d.data),

  projects: (familyId: string) =>
    fetch(`/api/projects?familyId=${familyId}`)
      .then((r) => r.json())
      .then((d) => d.data),

  sprints: (projectId: string) =>
    fetch(`/api/projects/${projectId}/sprints`)
      .then((r) => r.json())
      .then((d) => d.data),

  sprintDetail: (projectId: string, sprintId: string) =>
    fetch(`/api/projects/${projectId}/sprints/${sprintId}`)
      .then((r) => r.json())
      .then((d) => d.data),

  issues: (projectId: string, sprintId: string) =>
    fetch(`/api/issues?projectId=${projectId}&sprintId=${sprintId}`)
      .then((r) => r.json())
      .then((d) => d.data),

  backlog: (projectId: string) =>
    fetch(`/api/issues?projectId=${projectId}&backlogOnly=true`)
      .then((r) => r.json())
      .then((d) => d.data),

  patchIssue: (issueId: string, body: object) =>
    fetch(`/api/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()),

  createSprint: (projectId: string, body: object) =>
    fetch(`/api/projects/${projectId}/sprints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()),

  startSprint: (projectId: string, sprintId: string) =>
    fetch(`/api/projects/${projectId}/sprints/${sprintId}/start`, {
      method: "POST",
    }).then((r) => r.json()),

  completeSprint: (projectId: string, sprintId: string) =>
    fetch(`/api/projects/${projectId}/sprints/${sprintId}/complete`, {
      method: "POST",
    }).then((r) => r.json()),

  joinFamily: (body: object) =>
    fetch("/api/families/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()),

  createIssue: (body: {
    title: string;
    projectId: string;
    sprintId?: string | null;
    assigneeId?: string | null;
    priority?: string;
    points?: number;
  }) =>
    fetch("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()),
};
