from github import Github, GithubException


def get_client(github_token: str) -> Github:
    return Github(github_token)


def create_github_repo(name: str, description: str, github_token: str) -> dict:
    g = get_client(github_token)
    user = g.get_user()
    sanitized = name.lower().replace(" ", "-").replace("/", "-")[:50]
    try:
        repo = user.create_repo(
            name=sanitized,
            description=description,
            private=False,
            auto_init=True,
        )
        return {"url": repo.html_url, "name": repo.full_name, "created": True}
    except GithubException as e:
        if e.status == 422:
            repo = user.get_repo(sanitized)
            return {"url": repo.html_url, "name": repo.full_name, "created": False}
        raise


def create_github_issues(repo_full_name: str, issues: list[dict], github_token: str) -> list[dict]:
    g = get_client(github_token)
    repo = g.get_repo(repo_full_name)
    labels_created = set()
    created = []
    for issue in issues:
        label_name = issue.get("label", "task")
        if label_name not in labels_created:
            try:
                repo.create_label(label_name, "0075ca")
            except GithubException:
                pass
            labels_created.add(label_name)
        try:
            gh_issue = repo.create_issue(
                title=issue["title"],
                body=issue.get("body", ""),
                labels=[label_name],
            )
            created.append({"title": issue["title"], "url": gh_issue.html_url, "number": gh_issue.number})
        except GithubException as e:
            created.append({"title": issue["title"], "error": str(e)})
    return created
