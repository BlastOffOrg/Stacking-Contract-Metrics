// src/lib/utils.ts

export const STYLING = {
    BLUE: '\x1b[34m',
    RESET: '\x1b[0m',
    BOLD: '\x1b[1m',
    LINK: '\x1b[4m'
} as const;

export function createClickableLink(text: string, url: string): string {
    return `\x1b]8;;${url}\x1b\\${STYLING.BLUE}${STYLING.LINK}${text}${STYLING.RESET}\x1b]8;;\x1b\\`;
}

export async function updateEnvFile(key: string, value: string): Promise<void> {
    const fs = await import('fs');
    const envPath = '.env';
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    if (envContent.includes(`${key}=`)) {
        envContent = envContent.replace(
            new RegExp(`${key}=.*`),
            `${key}=${value}`
        );
    } else {
        envContent += `\n${key}=${value}`;
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log(`\n📝 Updated .env with ${key}: ${value}`);
}
