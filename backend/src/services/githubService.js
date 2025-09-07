const axios = require("axios");

class GitHubService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.api = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "MadaHost-App",
      },
    });
  }

  async getUserRepos(options = {}) {
    console.log(
      "🔍 Récupération des repos pour le token:",
      this.accessToken?.substring(0, 8) + "..."
    );

    try {
      const {
        page = 1,
        per_page = 100,
        sort = "updated",
        direction = "desc",
        type = "all",
      } = options;

      const response = await this.api.get("/user/repos", {
        params: {
          page,
          per_page,
          sort,
          direction,
          type,
          affiliation: "owner,collaborator",
        },
      });

      console.log("✅ Repos récupérés:", response.data?.length || 0);
      return response.data;
    } catch (error) {
      console.error(
        "❌ Erreur lors de la récupération des repos:",
        error.message
      );
      console.error("📍 Status:", error.response?.status);
      console.error("📍 Data:", error.response?.data);
      throw new Error(`Erreur GitHub API: ${error.message}`);
    }
  }

  async getRepository(owner, repo) {
    try {
      const response = await this.api.get(`/repos/${owner}/${repo}`);
      return response.data;
    } catch (error) {
      console.error("❌ Erreur récupération repo spécifique:", error.message);
      throw error;
    }
  }

  async getRepoBranches(owner, repo) {
    try {
      const response = await this.api.get(`/repos/${owner}/${repo}/branches`);
      return response.data;
    } catch (error) {
      console.error("❌ Erreur récupération branches:", error.message);
      throw error;
    }
  }
}

module.exports = GitHubService;
