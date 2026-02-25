/**
 * Simple Hash-Based Router
 * Handles client-side navigation without server configuration
 */

class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.notFoundHandler = null;

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
  }

  /**
   * Register a route handler
   * @param {string} pattern - Route pattern (e.g., '/', '/templates', '/job/:id')
   * @param {Function} handler - Handler function (params) => void
   */
  addRoute(pattern, handler) {
    this.routes.set(pattern, {
      pattern,
      handler,
      regex: this.patternToRegex(pattern)
    });
  }

  /**
   * Set 404 handler
   */
  setNotFound(handler) {
    this.notFoundHandler = handler;
  }

  /**
   * Convert route pattern to regex
   */
  patternToRegex(pattern) {
    const escaped = pattern.replace(/\//g, '\\/');
    const withParams = escaped.replace(/:([a-zA-Z0-9_]+)/g, '([^/]+)');
    return new RegExp(`^${withParams}$`);
  }

  /**
   * Extract params from URL
   */
  extractParams(pattern, path) {
    const paramNames = [];
    const regex = /:([a-zA-Z0-9_]+)/g;
    let match;

    while ((match = regex.exec(pattern)) !== null) {
      paramNames.push(match[1]);
    }

    const route = this.routes.get(pattern);
    const values = path.match(route.regex);

    if (!values) return {};

    const params = {};
    paramNames.forEach((name, i) => {
      params[name] = values[i + 1];
    });

    return params;
  }

  /**
   * Navigate to a route
   */
  navigate(path) {
    window.location.hash = path;
  }

  /**
   * Handle current route
   */
  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    let matched = false;

    for (const [pattern, route] of this.routes) {
      if (route.regex.test(hash)) {
        const params = this.extractParams(pattern, hash);
        this.currentRoute = { pattern, params, path: hash };
        route.handler(params);
        matched = true;
        break;
      }
    }

    if (!matched && this.notFoundHandler) {
      this.notFoundHandler(hash);
    }
  }

  /**
   * Get current route info
   */
  current() {
    return this.currentRoute;
  }
}

// Export singleton instance
const router = new Router();
window.router = router; // Make available globally
export default router;
