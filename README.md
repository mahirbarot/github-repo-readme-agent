# GitHub README Generator

A professional README generator that creates comprehensive documentation for your GitHub repositories. Simply paste your GitHub repository URL, and the application will generate a well-structured README file using the repository's information and AI-powered content generation.

## Features

- Automatic README generation from GitHub repository URL
- AI-powered content generation using GPT-4
- Professional and consistent formatting
- Comprehensive section coverage (Description, Features, Installation, Usage, etc.)
- Real-time preview
- Easy copy-and-paste functionality

## Technologies Used

- React
- Vite
- ChakraUI
- LangChain
- OpenAI GPT-4
- GitHub API
- Octokit

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/github-readme-generator.git
   cd github-readme-generator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add your API keys:
   ```
   VITE_GITHUB_TOKEN=your_github_token_here
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Open the application in your browser
2. Paste a GitHub repository URL into the input field
3. Click "Generate README"
4. Review the generated README
5. Copy the content and use it in your repository

## Required API Keys

- **GitHub Token**: Create a personal access token with `repo` scope at [GitHub Settings](https://github.com/settings/tokens)
- **OpenAI API Key**: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License
