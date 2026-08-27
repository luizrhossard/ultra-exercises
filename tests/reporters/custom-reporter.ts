import { TestCase, TestResult, FullResult, Reporter, Suite } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Custom reporter for enhanced test reporting
 * Generates summary markdown and JSON reports
 */
export default class CustomReporter implements Reporter {
  private results: TestResult[] = [];
  private startTime: number = Date.now();
  private outputDir: string;

  constructor(options: { outputDir?: string } = {}) {
    this.outputDir = options.outputDir || 'test-results/custom';
  }

  onBegin(config: any, suite: Suite): void {
    console.log(`🚀 Starting test run with ${config.projects.length} projects`);
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  onTestBegin(test: TestCase): void {
    // Test started
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.results.push(result);
    
    const status = result.status;
    const duration = result.duration;
    const project = test.parent.project()?.name || 'unknown';
    
    const icon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : status === 'skipped' ? '⏭️' : '❓';
    console.log(`${icon} [${project}] ${test.title} (${duration}ms)`);
    
    if (result.errors.length > 0) {
      result.errors.forEach(error => {
        console.log(`   Error: ${error.message}`);
      });
    }
  }

  onEnd(result: FullResult): void {
    const duration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const total = this.results.length;
    
    console.log('\n📊 Test Run Summary');
    console.log('===================');
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    
    // Generate JSON report
    this.generateJsonReport(result);
    
    // Generate Markdown summary
    this.generateMarkdownSummary(result);
    
    // Generate HTML summary
    this.generateHtmlSummary(result);
  }

  private generateJsonReport(result: FullResult): void {
    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'passed').length,
        failed: this.results.filter(r => r.status === 'failed').length,
        skipped: this.results.filter(r => r.status === 'skipped').length,
      },
      results: this.results.map(r => ({
        title: r.test?.title || 'Unknown Test',
        status: r.status,
        duration: r.duration,
        project: r.test?.parent?.project?.()?.name || 'unknown',
        errors: r.errors.map(e => ({ message: e.message, stack: e.stack })),
        attachments: r.attachments.map(a => ({ name: a.name, contentType: a.contentType, path: a.path })),
      })),
    };
    
    const jsonPath = path.join(this.outputDir, 'custom-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`📄 JSON report saved to ${jsonPath}`);
  }

  private generateMarkdownSummary(result: FullResult): void {
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const total = this.results.length;
    const duration = (Date.now() - this.startTime) / 1000;
    
    let markdown = `# E2E Test Results\n\n`;
    markdown += `**Run Date:** ${new Date().toISOString()}\n`;
    markdown += `**Duration:** ${duration.toFixed(2)}s\n\n`;
    markdown += `## Summary\n\n`;
    markdown += `| Status | Count |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| ✅ Passed | ${passed} |\n`;
    markdown += `| ❌ Failed | ${failed} |\n`;
    markdown += `| ⏭️ Skipped | ${skipped} |\n`;
    markdown += `| **Total** | **${total}** |\n\n`;
    
    // Group by project
    const byProject = new Map<string, TestResult[]>();
    this.results.forEach(r => {
      const project = r.test?.parent?.project?.()?.name || 'unknown';
      if (!byProject.has(project)) {
        byProject.set(project, []);
      }
      byProject.get(project)!.push(r);
    });
    
    markdown += `## Results by Project\n\n`;
    byProject.forEach((results, project) => {
      const pPassed = results.filter(r => r.status === 'passed').length;
      const pFailed = results.filter(r => r.status === 'failed').length;
      const pSkipped = results.filter(r => r.status === 'skipped').length;
      
      markdown += `### ${project}\n\n`;
      markdown += `| Status | Count |\n`;
      markdown += `|--------|-------|\n`;
      markdown += `| ✅ Passed | ${pPassed} |\n`;
      markdown += `| ❌ Failed | ${pFailed} |\n`;
      markdown += `| ⏭️ Skipped | ${pSkipped} |\n`;
      markdown += `| **Total** | **${results.length}** |\n\n`;
      
      if (pFailed > 0) {
        markdown += `#### Failed Tests\n\n`;
        results.filter(r => r.status === 'failed').forEach(r => {
          markdown += `- **${r.test?.title || 'Unknown Test'}**\n`;
          r.errors.forEach(e => {
            markdown += `  - ${e.message}\n`;
          });
        });
        markdown += `\n`;
      }
    });
    
    const mdPath = path.join(this.outputDir, 'SUMMARY.md');
    fs.writeFileSync(mdPath, markdown);
    console.log(`📝 Markdown summary saved to ${mdPath}`);
  }

  private generateHtmlSummary(result: FullResult): void {
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const total = this.results.length;
    const duration = (Date.now() - this.startTime) / 1000;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Test Results</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 30px; }
    h1 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat { background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; }
    .stat-value { font-size: 2.5em; font-weight: bold; }
    .stat-label { color: #666; margin-top: 5px; }
    .passed .stat-value { color: #28a745; }
    .failed .stat-value { color: #dc3545; }
    .skipped .stat-value { color: #ffc107; }
    .total .stat-value { color: #007bff; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; }
    tr:hover { background: #f8f9fa; }
    .status-passed { color: #28a745; font-weight: bold; }
    .status-failed { color: #dc3545; font-weight: bold; }
    .status-skipped { color: #ffc107; font-weight: bold; }
    .project-section { margin: 30px 0; }
    .project-title { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
    .error { background: #fff5f5; border-left: 4px solid #dc3545; padding: 10px; margin: 10px 0; font-family: monospace; font-size: 0.9em; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎭 E2E Test Results</h1>
    <p><strong>Run Date:</strong> ${new Date().toISOString()}</p>
    <p><strong>Duration:</strong> ${duration.toFixed(2)}s</p>
    
    <div class="summary">
      <div class="stat total">
        <div class="stat-value">${total}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat passed">
        <div class="stat-value">${passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat failed">
        <div class="stat-value">${failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat skipped">
        <div class="stat-value">${skipped}</div>
        <div class="stat-label">Skipped</div>
      </div>
      <div class="stat total">
        <div class="stat-value">${passRate}%</div>
        <div class="stat-label">Pass Rate</div>
      </div>
    </div>
    
    <h2>Results by Project</h2>`;
    
    // Group by project
    const byProject = new Map<string, TestResult[]>();
    this.results.forEach(r => {
      const project = r.test?.parent?.project?.()?.name || 'unknown';
      if (!byProject.has(project)) {
        byProject.set(project, []);
      }
      byProject.get(project)!.push(r);
    });
    
    byProject.forEach((results, project) => {
      const pPassed = results.filter(r => r.status === 'passed').length;
      const pFailed = results.filter(r => r.status === 'failed').length;
      const pSkipped = results.filter(r => r.status === 'skipped').length;
      
      html += `
    <div class="project-section">
      <div class="project-title">
        <h3>${project}</h3>
        <p>Passed: ${pPassed} | Failed: ${pFailed} | Skipped: ${pSkipped} | Total: ${results.length}</p>
      </div>
      <table>
        <thead>
          <tr><th>Test</th><th>Status</th><th>Duration</th></tr>
        </thead>
        <tbody>`;
      
      results.forEach(r => {
        const statusClass = `status-${r.status}`;
        html += `
          <tr>
            <td>${r.test?.title || 'Unknown Test'}</td>
            <td class="${statusClass}">${r.status.toUpperCase()}</td>
            <td>${r.duration}ms</td>
          </tr>`;
      });
      
      html += `
        </tbody>
      </table>`;
      
      if (pFailed > 0) {
        html += `<h4>Failed Tests Details</h4>`;
        results.filter(r => r.status === 'failed').forEach(r => {
          html += `<div class="error"><strong>${r.test?.title || 'Unknown Test'}</strong><br>`;
          r.errors.forEach(e => {
            html += `${e.message}<br>`;
          });
          html += `</div>`;
        });
      }
      
      html += `</div>`;
    });
    
    html += `
    <div class="footer">
      <p>Generated by Playwright Custom Reporter</p>
      <p>Ultra Exercises E2E Test Suite</p>
    </div>
  </div>
</body>
</html>`;
    
    const htmlPath = path.join(this.outputDir, 'summary.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`🌐 HTML summary saved to ${htmlPath}`);
  }
}