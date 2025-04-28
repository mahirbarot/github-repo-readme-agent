import { useState, useEffect, useRef } from 'react';
import { Octokit } from 'octokit';
import Groq from 'groq-sdk';
import ReactMarkdown from 'react-markdown';

const ReadmeGenerator = () => {
  const [githubUrl, setGithubUrl] = useState('');
  const [generatedReadme, setGeneratedReadme] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [repoInfo, setRepoInfo] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('mistral-saba-24b');
  const [apiKeysWarning, setApiKeysWarning] = useState({
    github: !import.meta.env.VITE_GITHUB_TOKEN,
    groq: !import.meta.env.VITE_GROQ_API_KEY
  });
  const [availableModels, setAvailableModels] = useState([
    { id: 'mistral-saba-24b', name: 'Mistral Saba 24B', enabled: true },
    { id: 'qwen-2.5-32b', name: 'Qwen 2.5 32B', enabled: true },
    { id: 'qwen-2.5-coder-32b', name: 'Qwen 2.5 Coder 32B (Coming Soon)', enabled: false },
    { id: 'qwen-qwq-32b', name: 'Qwen QWQ 32B (Coming Soon)', enabled: false },
    { id: 'deepseek-r1-distill-qwen-32b', name: 'DeepSeek R1 Distill Qwen 32B (Coming Soon)', enabled: false },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill LLaMA 70B (Coming Soon)', enabled: false },
    { id: 'gemma2-9b-it', name: 'Gemma2 9B IT (Coming Soon)', enabled: false },
    { id: 'distil-whisper-large-v3-en', name: 'Distil Whisper Large V3 EN (Coming Soon)', enabled: false }
  ]);
  const [customSections, setCustomSections] = useState({
    features: true,
    installation: true,
    usage: true,
    contributing: true,
    license: true,
    badges: true,
    screenshots: true,
    testing: true,
    roadmap: true,
    acknowledgements: true,
    faq: false,
    troubleshooting: false,
    architecture: false,
    requirements: true,
    api_docs: false
  });
  const [hasCustomReadme, setHasCustomReadme] = useState(false);
  const [existingReadme, setExistingReadme] = useState('');
  const [hasBranchProtection, setHasBranchProtection] = useState(false);
  const [readmeHistory, setReadmeHistory] = useState([]);
  const [selectedReadmeIndex, setSelectedReadmeIndex] = useState(-1);
  const textareaRef = useRef(null);
  const promptRef = useRef(null);

  // Templates for different README styles
  const templates = {
    standard: "Standard professional README",
    minimal: "Minimal README with essential sections only",
    detailed: "Comprehensive README with all sections", 
    developer: "Developer-focused with technical details",
    opensource: "Open-source focused with contribution guidelines",
    beginner: "Beginner-friendly with detailed explanations",
    corporate: "Corporate style with formal language"
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type) => {
    setToast({ message, type });
  };

  const extractRepoInfo = (url) => {
    try {
      const regex = /github\.com\/([^\/]+)\/([^\/]+)/;
      const matches = url.match(regex);
      if (!matches) throw new Error('Invalid GitHub URL');
      return { owner: matches[1], repo: matches[2].replace(/\.git$/, '') };
    } catch (error) {
      throw new Error('Invalid GitHub URL format');
    }
  };

  const fetchRepoDetails = async () => {
    try {
      if (!githubUrl) {
        showToast('Please enter a GitHub URL', 'error');
        return null;
      }

      const { owner, repo } = extractRepoInfo(githubUrl);
      
      // Initialize GitHub API client with token if available
      const octokit = new Octokit({
        auth: import.meta.env.VITE_GITHUB_TOKEN
      });
      
      // Show a warning if no token is provided
      if (!import.meta.env.VITE_GITHUB_TOKEN) {
        console.warn('No GitHub token provided. Using unauthenticated requests with lower rate limits.');
      }

      // First fetch repository information
      const repoData = await octokit.rest.repos.get({ owner, repo });

      // Then fetch other data using repoData
      const [languages, contents, releases, contributors, branchProtection] = await Promise.all([
        octokit.rest.repos.listLanguages({ owner, repo }),
        octokit.rest.repos.getContent({ owner, repo, path: '' }),
        octokit.rest.repos.listReleases({ owner, repo }).catch(() => ({ data: [] })),
        octokit.rest.repos.listContributors({ owner, repo }).catch(() => ({ data: [] })),
        octokit.rest.repos.getBranchProtection({ 
          owner, 
          repo, 
          branch: repoData.data.default_branch 
        }).catch(() => null)
      ]);

      // Check if README exists
      let readmeContent = '';
      try {
        const readmeFiles = contents.data.filter(file => 
          file.name.toLowerCase() === 'readme.md' || 
          file.name.toLowerCase() === 'readme'
        );
        
        if (readmeFiles.length > 0) {
          const readmeFile = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: readmeFiles[0].path
          });
          
          if (readmeFile.data.content) {
            readmeContent = Buffer.from(readmeFile.data.content, 'base64').toString();
            setHasCustomReadme(true);
            setExistingReadme(readmeContent);
          }
        }
      } catch (error) {
        console.error('Error fetching README:', error);
      }

      // Check for branch protection
      setHasBranchProtection(!!branchProtection);

      // Check for package.json to detect dependencies
      let dependencies = [];
      let devDependencies = [];
      
      try {
        const packageJson = await octokit.rest.repos.getContent({ 
          owner, 
          repo, 
          path: 'package.json' 
        });
        
        if (packageJson.data && packageJson.data.content) {
          const content = JSON.parse(
            Buffer.from(packageJson.data.content, 'base64').toString()
          );
          
          dependencies = Object.keys(content.dependencies || {});
          devDependencies = Object.keys(content.devDependencies || {});
        }
      } catch (error) {
        // package.json not found, continue without it
      }

      // Check for common project structures
      const fileNames = contents.data.map(file => file.name);
      const detectedFrameworks = detectFrameworks(fileNames, dependencies);
      
      // Detect CI/CD configuration
      const hasCICD = detectCICD(fileNames);
      
      // Detect documentation
      const hasDocumentation = detectDocumentation(fileNames);

      // Prepare repository context
      const repoContext = {
        name: repoData.data.name,
        description: repoData.data.description || '',
        owner: owner,
        languages: Object.keys(languages.data),
        languageStats: languages.data,
        files: fileNames,
        dependencies,
        devDependencies,
        frameworks: detectedFrameworks,
        stars: repoData.data.stargazers_count,
        forks: repoData.data.forks_count,
        watchers: repoData.data.watchers_count,
        openIssues: repoData.data.open_issues_count,
        defaultBranch: repoData.data.default_branch,
        topics: repoData.data.topics || [],
        license: repoData.data.license ? repoData.data.license.name : null,
        homepage: repoData.data.homepage,
        hasIssues: repoData.data.has_issues,
        hasWiki: repoData.data.has_wiki,
        isTemplate: repoData.data.is_template,
        isArchived: repoData.data.archived,
        createdAt: repoData.data.created_at,
        updatedAt: repoData.data.updated_at,
        pushedAt: repoData.data.pushed_at,
        releases: releases.data.map(r => ({ 
          name: r.name, 
          tag: r.tag_name, 
          date: r.published_at 
        })).slice(0, 5),
        contributors: contributors.data.map(c => ({
          login: c.login,
          contributions: c.contributions,
          url: c.html_url
        })).slice(0, 10),
        hasCICD,
        hasDocumentation,
        hasReadme: !!readmeContent,
        readmeContent
      };

      setRepoInfo(repoContext);
      return repoContext;
    } catch (error) {
      console.error('Error fetching repo details:', error);
      showToast(error.message, 'error');
      return null;
    }
  };

  const detectFrameworks = (files, dependencies) => {
    const frameworks = [];
    
    // Detect frameworks based on files
    if (files.includes('angular.json')) frameworks.push('Angular');
    if (files.includes('vue.config.js')) frameworks.push('Vue.js');
    if (files.includes('next.config.js')) frameworks.push('Next.js');
    if (files.includes('gatsby-config.js')) frameworks.push('Gatsby');
    if (files.includes('nuxt.config.js')) frameworks.push('Nuxt.js');
    if (files.includes('svelte.config.js')) frameworks.push('Svelte');
    if (files.includes('remix.config.js')) frameworks.push('Remix');
    if (files.includes('django-admin.py') || files.includes('manage.py')) frameworks.push('Django');
    if (files.includes('Gemfile') && files.includes('config.ru')) frameworks.push('Ruby on Rails');
    if (files.includes('composer.json') && files.includes('artisan')) frameworks.push('Laravel');
    if (files.includes('pom.xml')) frameworks.push('Java/Maven');
    if (files.includes('build.gradle')) frameworks.push('Java/Gradle');
    if (files.includes('go.mod')) frameworks.push('Go');
    if (files.includes('Cargo.toml')) frameworks.push('Rust');
    if (files.includes('requirements.txt') || files.includes('setup.py')) frameworks.push('Python');
    if (files.includes('.csproj') || files.includes('.sln')) frameworks.push('.NET');
    if (files.includes('docker-compose.yml') || files.includes('Dockerfile')) frameworks.push('Docker');
    
    // Detect frameworks based on dependencies
    const dependencyMap = {
      'react': 'React',
      'react-dom': 'React',
      'express': 'Express.js',
      'koa': 'Koa.js',
      'fastify': 'Fastify',
      'nest': 'NestJS',
      'flask': 'Flask',
      'django': 'Django',
      'tensorflow': 'TensorFlow',
      'pytorch': 'PyTorch',
      'dotnet': '.NET',
      'electron': 'Electron',
      'flutter': 'Flutter',
      'react-native': 'React Native'
    };
    
    dependencies.forEach(dep => {
      if (dependencyMap[dep] && !frameworks.includes(dependencyMap[dep])) {
        frameworks.push(dependencyMap[dep]);
      }
    });
    
    return frameworks;
  };

  const detectCICD = (files) => {
    const cicdFiles = [
      '.github/workflows',
      '.gitlab-ci.yml',
      '.travis.yml',
      'Jenkinsfile',
      'azure-pipelines.yml',
      '.circleci/config.yml'
    ];
    
    return files.some(file => cicdFiles.includes(file));
  };

  const detectDocumentation = (files) => {
    const docFiles = [
      'docs',
      'documentation',
      'wiki',
      'CONTRIBUTING.md',
      'CHANGELOG.md',
      'CODE_OF_CONDUCT.md'
    ];
    
    return files.some(file => docFiles.includes(file));
  };

  const generateBadges = (repo) => {
    if (!repo) return '';
    
    const badges = [];
    
    // Add license badge if available
    if (repo.license) {
      badges.push(`[![License](https://img.shields.io/badge/License-${encodeURIComponent(repo.license.replace(/ /g, '_'))}-blue.svg)](https://opensource.org/licenses/)`);
    }
    
    // Add GitHub stats badges
    badges.push(`[![GitHub stars](https://img.shields.io/github/stars/${repo.owner}/${repo.name}.svg)](https://github.com/${repo.owner}/${repo.name}/stargazers)`);
    badges.push(`[![GitHub forks](https://img.shields.io/github/forks/${repo.owner}/${repo.name}.svg)](https://github.com/${repo.owner}/${repo.name}/network)`);
    badges.push(`[![GitHub issues](https://img.shields.io/github/issues/${repo.owner}/${repo.name}.svg)](https://github.com/${repo.owner}/${repo.name}/issues)`);
    
    // Add language badges for the top languages
    const topLanguages = Object.entries(repo.languageStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang]) => lang);
      
    topLanguages.forEach(lang => {
      const color = getLanguageColor(lang);
      badges.push(`![${lang}](https://img.shields.io/badge/${encodeURIComponent(lang)}-${color}?style=flat&logo=${encodeURIComponent(lang.toLowerCase())}&logoColor=white)`);
    });
    
    // Add framework badges
    repo.frameworks.forEach(framework => {
      badges.push(`![${framework}](https://img.shields.io/badge/${encodeURIComponent(framework.replace('.', '').replace(' ', ''))}-informational?style=flat&logo=${encodeURIComponent(framework.toLowerCase().replace('.', '').replace(' ', ''))}&logoColor=white)`);
    });
    
    // Add CI/CD badge if detected
    if (repo.hasCICD) {
      badges.push(`![CI/CD](https://img.shields.io/badge/CI%2FCD-Configured-success)`);
    }
    
    // Add Documentation badge if detected
    if (repo.hasDocumentation) {
      badges.push(`![Docs](https://img.shields.io/badge/Documentation-Available-success)`);
    }
    
    return badges.join(' ');
  };
  
  const getLanguageColor = (language) => {
    // Common language colors
    const colors = {
      'JavaScript': 'F7DF1E',
      'TypeScript': '3178C6',
      'Python': '3776AB',
      'Java': '007396',
      'Go': '00ADD8',
      'Rust': 'DEA584',
      'C++': '00599C',
      'C#': '239120',
      'PHP': '777BB4',
      'Ruby': 'CC342D',
      'HTML': 'E34F26',
      'CSS': '1572B6',
      'Shell': '4EAA25',
      'Dart': '0175C2',
      'Swift': 'FA7343',
      'Kotlin': '7F52FF',
    };
    
    return colors[language] || '555555';
  };

  const buildDefaultPrompt = (repoContext, badges, sections) => {
    // Build sections string
    const sectionsText = [
      '1. Title with attractive formatting and badges',
      '2. Brief Overview/Introduction with key value proposition'
    ];

    // Add selected sections
    let sectionNum = 3;
    if (sections.includes('features')) sectionsText.push(`${sectionNum++}. Features (detailed but concise bullet points)`);
    if (sections.includes('requirements')) sectionsText.push(`${sectionNum++}. Requirements and Prerequisites`);
    if (sections.includes('installation')) sectionsText.push(`${sectionNum++}. Installation (step-by-step instructions with code blocks)`);
    if (sections.includes('usage')) sectionsText.push(`${sectionNum++}. Usage (with code examples and explanations)`);
    if (sections.includes('screenshots')) sectionsText.push(`${sectionNum++}. Screenshots/Demo (placeholders with instructions)`);
    if (sections.includes('api_docs')) sectionsText.push(`${sectionNum++}. API Documentation`);
    if (sections.includes('architecture')) sectionsText.push(`${sectionNum++}. Architecture Overview`);
    if (sections.includes('testing')) sectionsText.push(`${sectionNum++}. Testing Instructions`);
    if (sections.includes('troubleshooting')) sectionsText.push(`${sectionNum++}. Troubleshooting and FAQs`);
    if (sections.includes('roadmap')) sectionsText.push(`${sectionNum++}. Roadmap/Future Enhancements`);
    if (sections.includes('contributing')) sectionsText.push(`${sectionNum++}. Contributing Guidelines`);
    if (sections.includes('acknowledgements')) sectionsText.push(`${sectionNum++}. Acknowledgements (including contributors: ${repoContext.contributors.map(c => c.login).join(', ')})`);
    if (sections.includes('license')) sectionsText.push(`${sectionNum++}. License Information`);

    // Add existing README analysis if present
    const existingReadmeInfo = repoContext.hasReadme ? 
      `\n\nThe repository already has a README with the following content that you can use as a reference:\n\n${repoContext.readmeContent.substring(0, 1000)}${repoContext.readmeContent.length > 1000 ? '...(truncated)' : ''}` : '';

    const prompt = `You are a professional technical writer creating a comprehensive README.md file for a GitHub repository. Create a ${templates[selectedTemplate]} with the following information:

Repository Name: ${repoContext.name}
Owner: ${repoContext.owner}
Description: ${repoContext.description}
Programming Languages: ${repoContext.languages.join(', ')}
Frameworks/Libraries: ${repoContext.frameworks.join(', ')}
Dependencies: ${repoContext.dependencies.join(', ')}
Key Files: ${repoContext.files.join(', ')}
Stars: ${repoContext.stars}
Forks: ${repoContext.forks}
Open Issues: ${repoContext.openIssues}
Topics: ${repoContext.topics.join(', ')}
License: ${repoContext.license || 'Not specified'}
Created: ${new Date(repoContext.createdAt).toLocaleDateString()}
Last Updated: ${new Date(repoContext.updatedAt).toLocaleDateString()}

Include these badges at the top of the README:
${badges}

Please include the following sections:
${sectionsText.join('\n')}${existingReadmeInfo}

IMPORTANT FORMATTING INSTRUCTIONS:
1. Do NOT include triple backticks at the beginning or end of your response
2. Make it detailed, professional, extremely well-formatted in Markdown
3. Include appropriate emojis for section headers if suitable for the template style
4. If this is a coding project, include code snippets showing usage examples
5. For installation, be specific about prerequisites and commands
6. Organize everything logically and make the README comprehensive but easy to navigate
7. Use proper Markdown formatting throughout the document`;

    return prompt;
  };

  const generateReadme = async () => {
    try {
      setLoading(true);
      setGeneratedReadme(''); // Clear existing content
      
      // Fetch repository details if not already done
      const repoContext = repoInfo || await fetchRepoDetails();
      if (!repoContext) {
        setLoading(false);
        return;
      }

      // Generate badges
      const badges = generateBadges(repoContext);
      
      // Get selected sections
      const sections = Object.entries(customSections)
        .filter(([_, isSelected]) => isSelected)
        .map(([section]) => section);
        
      // Initialize Groq client
      const groq = new Groq({
        apiKey: import.meta.env.VITE_GROQ_API_KEY,
        dangerouslyAllowBrowser: true
      });

      // Check if GROQ API key is available
      if (!import.meta.env.VITE_GROQ_API_KEY) {
        throw new Error('GROQ API key is missing. Please add it to your environment variables as VITE_GROQ_API_KEY.');
      }

      // Build the base prompt
      const basePrompt = buildDefaultPrompt(repoContext, badges, sections);
      
      // Determine which prompt to use
      let finalPrompt;
      if (useCustomPrompt && customPrompt.trim()) {
        // Combine the default prompt with custom instructions
        finalPrompt = `${basePrompt}\n\nADDITIONAL CUSTOM INSTRUCTIONS:\n${customPrompt
          .replace('{{REPO_NAME}}', repoContext.name)
          .replace('{{OWNER}}', repoContext.owner)
          .replace('{{DESCRIPTION}}', repoContext.description)
          .replace('{{LANGUAGES}}', repoContext.languages.join(', '))
          .replace('{{FRAMEWORKS}}', repoContext.frameworks.join(', '))
          .replace('{{DEPENDENCIES}}', repoContext.dependencies.join(', '))
          .replace('{{BADGES}}', badges)
          .replace('{{TEMPLATE}}', templates[selectedTemplate])}`;
      } else {
        // Use the default prompt
        finalPrompt = basePrompt;
      }

      // Store the generated prompt
      setGeneratedPrompt(finalPrompt);

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: finalPrompt
          }
        ],
        model: selectedModel,
        temperature: 0.7,
        max_tokens: 4096,
        top_p: 1,
        stream: true,
        stop: null
      });

      let fullResponse = '';
      for await (const chunk of chatCompletion) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
        setGeneratedReadme(prevContent => prevContent + content);
      }

      // Clean response (remove triple backticks if present)
      const cleanedResponse = fullResponse
        .replace(/^```(?:markdown|md)?\s*/i, '')
        .replace(/\s*```\s*$/i, '');
      
      if (cleanedResponse !== fullResponse) {
        setGeneratedReadme(cleanedResponse);
      }

      // Add to history
      setReadmeHistory(prev => [...prev, cleanedResponse]);
      setSelectedReadmeIndex(readmeHistory.length);

      showToast('README Generated!', 'success');
    } catch (error) {
      console.error('Error:', error);
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(message, 'success');
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const downloadReadme = () => {
    const element = document.createElement('a');
    const file = new Blob([generatedReadme], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = 'README.md';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast('README downloaded!', 'success');
  };

  const toggleSection = (section) => {
    setCustomSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const generateDefaultPrompt = () => {
    if (!repoInfo) {
      showToast('Please analyze a repository first', 'error');
      return;
    }

    const badges = generateBadges(repoInfo);
    const sections = Object.entries(customSections)
      .filter(([_, isSelected]) => isSelected)
      .map(([section]) => section);

    const defaultPrompt = buildDefaultPrompt(repoInfo, badges, sections);
    setCustomPrompt(defaultPrompt);
  };

  const regenerateReadme = async () => {
    if (!repoInfo) {
      showToast('Please analyze a repository first', 'error');
      return;
    }
    
    setGeneratedReadme('');
    await generateReadme();
  };

  const viewVersionHistory = (index) => {
    if (index >= 0 && index < readmeHistory.length) {
      setGeneratedReadme(readmeHistory[index]);
      setSelectedReadmeIndex(index);
    }
  };

  const selectAllSections = () => {
    const newSections = {};
    Object.keys(customSections).forEach(key => {
      newSections[key] = true;
    });
    setCustomSections(newSections);
  };

  const deselectAllSections = () => {
    const newSections = {};
    Object.keys(customSections).forEach(key => {
      newSections[key] = false;
    });
    setCustomSections(newSections);
  };

  const applyTemplatePreset = (preset) => {
    switch (preset) {
      case 'minimal':
        setCustomSections({
          ...Object.fromEntries(Object.keys(customSections).map(key => [key, false])),
          features: true,
          installation: true,
          usage: true,
          license: true
        });
        break;
      case 'developer':
        setCustomSections({
          ...Object.fromEntries(Object.keys(customSections).map(key => [key, false])),
          features: true,
          installation: true,
          usage: true,
          api_docs: true,
          architecture: true,
          testing: true,
          license: true
        });
        break;
      case 'complete':
        selectAllSections();
        break;
      default:
        break;
    }
  };

  return (
    <div className="container">
      <div className="content-wrapper">
        <h1 className="title">
          GitHub README Generator AI Agent
        </h1>
        
        {(apiKeysWarning.github || apiKeysWarning.groq) && (
          <div className="api-warning">
            <h3>⚠️ API Key Warning</h3>
            {apiKeysWarning.github && (
              <p>
                GitHub API token is missing. You can still use the app with limited functionality, but you might encounter rate limits.
                To add your token, create a <code>.env</code> file with <code>VITE_GITHUB_TOKEN=your_token_here</code>.
              </p>
            )}
            {apiKeysWarning.groq && (
              <p>
                GROQ API key is missing. README generation will not work without this key.
                To add your key, create a <code>.env</code> file with <code>VITE_GROQ_API_KEY=your_key_here</code>.
                You can get a key from <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">Groq Console</a>.
              </p>
            )}
          </div>
        )}
        
        <div className="section">
          <div className="input-group">
            <input
              className="input-field"
              placeholder="Enter GitHub repository URL (e.g., https://github.com/username/repo)"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
            />
            <button
              className="button button-primary"
              onClick={fetchRepoDetails}
              disabled={loading}
            >
              Analyze Repo
            </button>
          </div>
          
          {repoInfo && (
            <div className="section">
              <h3 className="section-title">Repository Analysis</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p><span className="font-medium">Name:</span> {repoInfo.name}</p>
                  <p><span className="font-medium">Owner:</span> {repoInfo.owner}</p>
                  <p><span className="font-medium">Languages:</span> {repoInfo.languages.join(', ')}</p>
                  <p><span className="font-medium">Stars:</span> {repoInfo.stars}</p>
                  {hasCustomReadme && (
                    <p className="text-green-600">
                      <span className="font-medium">Existing README:</span> Yes
                      <button
                        className="ml-2 text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                        onClick={() => {
                          setShowPreview(true);
                          setGeneratedReadme(existingReadme);
                        }}
                      >
                        View
                      </button>
                    </p>
                  )}
                </div>
                <div>
                  <p><span className="font-medium">Frameworks:</span> {repoInfo.frameworks.length ? repoInfo.frameworks.join(', ') : 'None detected'}</p>
                  <p><span className="font-medium">Topics:</span> {repoInfo.topics.length ? repoInfo.topics.join(', ') : 'None'}</p>
                  <p><span className="font-medium">License:</span> {repoInfo.license || 'Not specified'}</p>
                  <p><span className="font-medium">Last Updated:</span> {new Date(repoInfo.updatedAt).toLocaleDateString()}</p>
                  {hasBranchProtection && (
                    <p className="text-blue-600">
                      <span className="font-medium">Branch Protection:</span> Enabled
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="section">
            <h3 className="section-title">README Style</h3>
            <div className="template-buttons">
              {Object.entries(templates).map(([key, description]) => (
                <button 
                  key={key}
                  className={`template-button ${selectedTemplate === key ? 'active' : ''}`}
                  onClick={() => setSelectedTemplate(key)}
                  title={description}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          <div className="section">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Customize Sections</h3>
              <div className="flex gap-2 custom-btn">
                <button
                  className="button button-sm button-secondary"
                  onClick={selectAllSections}
                >
                  Select All
                </button>
                <button
                  className="button button-sm button-secondary"
                  onClick={deselectAllSections}
                >
                  Deselect All
                </button>
                <select 
                  className="select-input"
                  onChange={(e) => applyTemplatePreset(e.target.value)}
                  value=""
                >
                  <option value="" disabled>Apply preset...</option>
                  <option value="minimal">Minimal</option>
                  <option value="developer">Developer-focused</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
            </div>
            <div className="checkbox-group">
              {Object.entries(customSections).map(([section, isSelected]) => (
                <label key={section} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSection(section)}
                    className="checkbox-input"
                  />
                  <span className="capitalize">{section.replace('_', ' ')}</span>
                  </label>
              ))}
            </div>
          </div>
          
          <div className="section">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Model Selection</h3>
              <select 
                className="select-input"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {availableModels.map(model => (
                  <option 
                    key={model.id} 
                    value={model.id}
                    disabled={!model.enabled}
                    style={!model.enabled ? { color: '#999', fontStyle: 'italic' } : {}}
                  >
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="section">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Advanced Options</h3>
              <label className="switch-label">
                <span className="mr-2">Custom Instructions</span>
                <div className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={useCustomPrompt}
                    onChange={() => setUseCustomPrompt(!useCustomPrompt)}
                    className="toggle-input"
                  />
                  <span className="toggle-slider"></span>
                </div>
              </label>
            </div>

            {useCustomPrompt && (
              <div className="custom-prompt-container">
                <div className="flex justify-between mb-2">
                  <p className="text-sm text-gray-600">
                    Add custom instructions to modify the README generation. Your instructions will be appended to the default prompt. You can use placeholders like{' '}
                    <code>{'{{REPO_NAME}}'}</code>,{' '}
                    <code>{'{{OWNER}}'}</code>,{' '}
                    <code>{'{{DESCRIPTION}}'}</code>,{' '}
                    <code>{'{{LANGUAGES}}'}</code>,{' '}
                    <code>{'{{FRAMEWORKS}}'}</code>,{' '}
                    <code>{'{{DEPENDENCIES}}'}</code>,{' '}
                    <code>{'{{BADGES}}'}</code>,{' '}
                    <code>{'{{TEMPLATE}}'}</code>.
                  </p>
                  <button 
                    className="button button-secondary text-sm py-1 px-3"
                    onClick={generateDefaultPrompt}
                  >
                    Load Default
                  </button>
                </div>
                <textarea
                  ref={promptRef}
                  className="textarea prompt-textarea"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Enter additional instructions for the AI like 'do not use emojis', 'use corporate tone', 'include diagrams', etc."
                  rows={6}
                />
              </div>
            )}
          </div>
          
          <div className="flex justify-center">
            <button
              className="button button-success"
              onClick={generateReadme}
              disabled={loading || !repoInfo}
            >
              {loading ? 'Generating...' : 'Generate Professional README'}
            </button>
          </div>
        </div>
        
        {generatedReadme && (
          <div className="output-container">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Generated README</h2>
              <div className="flex gap-2">
                {readmeHistory.length > 1 && (
                  <select
                    className="select-input"
                    value={selectedReadmeIndex}
                    onChange={(e) => viewVersionHistory(parseInt(e.target.value))}
                  >
                    <option value="-1" disabled>Version History</option>
                    {readmeHistory.map((_, index) => (
                      <option key={index} value={index}>
                        Version {index + 1}
                      </option>
                    ))}
                  </select>
                )}
                <button 
                  className="button button-secondary"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? 'Show Markdown' : 'Show Preview'}
                </button>
                <button 
                  className="button button-primary"
                  onClick={() => copyToClipboard(generatedReadme, 'README copied to clipboard!')}
                >
                  Copy to Clipboard
                </button>
                <button 
                  className="button button-success"
                  onClick={downloadReadme}
                >
                  Download README.md
                </button>
                <button 
                  className="button button-secondary"
                  onClick={regenerateReadme}
                  disabled={loading}
                >
                  Regenerate
                </button>
              </div>
            </div>
            
            {showPreview ? (
              <div className="bg-white border border-gray-300 rounded-md p-6 markdown-preview">
                <ReactMarkdown>{generatedReadme}</ReactMarkdown>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                className="textarea"
                value={generatedReadme}
                onChange={(e) => setGeneratedReadme(e.target.value)}
              />
            )}

            {generatedPrompt && useCustomPrompt && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-md font-semibold">Used Prompt</h3>
                  <button 
                    className="button button-secondary text-sm py-1 px-3"
                    onClick={() => copyToClipboard(generatedPrompt, 'Prompt copied to clipboard!')}
                  >
                    Copy Prompt
                  </button>
                </div>
                <div className="collapse-panel">
                  <div 
                    className="collapse-header" 
                    onClick={() => setShowPromptPreview(!showPromptPreview)}
                  >
                    <span>View Prompt</span>
                    <span className={`arrow ${showPromptPreview ? 'down' : 'right'}`}>▶</span>
                  </div>
                  {showPromptPreview && (
                    <pre className="collapse-content">{generatedPrompt}</pre>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        {toast && (
          <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
            {toast.message}
          </div>
        )}
      </div>
      
      {/* Add CSS for new components */}
      <style jsx>{`
        .api-warning {
          background-color: #fff3cd;
          color: #856404;
          border: 1px solid #ffeeba;
          border-radius: 0.375rem;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .api-warning h3 {
          margin-top: 0;
          font-size: 1.1rem;
        }
        
        .api-warning p {
          margin-bottom: 0.5rem;
        }
        
        .api-warning code {
          background-color: #fff;
          padding: 0.2rem 0.4rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
        }
        
        .api-warning a {
          color: #0056b3;
          text-decoration: underline;
        }
        
        .select-input {
          padding: 0.5rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.375rem;
          background-color: white;
          font-size: 0.875rem;
        }
        
        .button-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
        }
        
        .markdown-preview img {
          max-width: 100%;
          height: auto;
        }
        
        .collapse-panel {
          border: 1px solid #e2e8f0;
          border-radius: 0.375rem;
          overflow: hidden;
        }
        
        .collapse-header {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background-color: #f8fafc;
          cursor: pointer;
          font-weight: 500;
        }
        
        .collapse-content {
          padding: 1rem;
          background-color: #f1f5f9;
          max-height: 300px;
          overflow-y: auto;
          white-space: pre-wrap;
          font-size: 0.875rem;
          font-family: monospace;
        }
        
        .arrow {
          transition: transform 0.2s;
        }
        
        .arrow.down {
          transform: rotate(90deg);
        }
      `}</style>
    </div>
  );
};

export default ReadmeGenerator;