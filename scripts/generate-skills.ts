// scripts/generate-skills.ts
// Centralized skill generator — creates compatible formats for opencode, kilocode, and claude-code

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'

interface SkillManifest {
  name: string
  description: string
}

async function generate() {
  const skillDirs = await readdir('.skills', { withFileTypes: true })
  const skills = skillDirs.filter((d) => d.isDirectory()).map((d) => d.name)

  for (const skillName of skills) {
    const manifestPath = `.skills/${skillName}/manifest.yaml`
    const contentPath = `.skills/${skillName}/content.md`

    const manifestRaw = await readFile(manifestPath, 'utf8')
    const contentRaw = await readFile(contentPath, 'utf8')

    const manifest = parseYaml(manifestRaw)

    // Generate opencode format (YAML frontmatter + content)
    const opencodeSkill = `---
name: ${manifest.name}
description: ${manifest.description}
---
${contentRaw}`

    const opencodeDir = join('.opencode/skill', manifest.name)
    await mkdir(opencodeDir, { recursive: true })
    await writeFile(join(opencodeDir, 'SKILL.md'), opencodeSkill)

    // Generate kilocode format (YAML frontmatter + content, skills dir is plural)
    const kilocodeDir = join('.kilo/skills', manifest.name)
    await mkdir(kilocodeDir, { recursive: true })
    await writeFile(join(kilocodeDir, 'SKILL.md'), opencodeSkill)

    // [audit] removed: console.log(`Generated: ${manifest.name}`)
  }
}

function parseYaml(yaml: string): SkillManifest {
  const nameMatch = yaml.match(/^name:\s*(.*)$/m)
  const descMatch = yaml.match(/^description:\s*(.*)$/m)
  return {
    name: nameMatch?.[1]?.trim() ?? 'unknown',
    description: descMatch?.[1]?.trim() ?? '',
  }
}

await generate()