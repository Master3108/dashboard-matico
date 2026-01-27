import React, { useState, useEffect } from 'react';
import 'katex/dist/katex.min.css';

const MathRenderer = ({ text, content }) => {
    const rawText = text || content;
    const [htmlContent, setHtmlContent] = useState('');

    useEffect(() => {
        if (!rawText) {
            setHtmlContent('');
            return;
        }

        const processContent = async () => {
            // Import katex dynamically
            const katex = (await import('katex')).default;

            let processed = rawText;

            try {
                // Step 1: Clean N8N triple escaping: \\\[ -> \[, \\\( -> \(
                processed = processed
                    .replace(/\\\\\\\\/g, '\\')  // Quad backslash to single
                    .replace(/\\\\\\/g, '\\')     // Triple backslash to single
                    .replace(/\\\\/g, '\\');       // Double backslash to single

                // Step 2: Convert LaTeX delimiters to dollar signs  
                // Display math: \[ content \] -> $$ content $$
                processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (match, content) => {
                    return `$$${content}$$`;
                });

                // Inline math: \( content \) -> $ content $
                processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (match, content) => {
                    return `$${content}$`;
                });

                // Step 3: Clean remaining dollar sign escaping
                processed = processed
                    .replace(/\\\$\$/g, '$$')
                    .replace(/\\\$/g, '$')
                    .replace(/\\n/g, '\n');

                // Step 4: Fix newline escaping
                processed = processed.replace(/\\n/g, '\n');

                // Step 5: Fix double-escaped LaTeX commands
                const commands = ['frac', 'sqrt', 'pi', 'times', 'cdot', 'left', 'right', 'mathbf', 'mathrm', 'text', 'le', 'ge', 'ne', 'approx'];
                commands.forEach(cmd => {
                    const regex = new RegExp(`\\\\\\\\(${cmd})`, 'g');
                    processed = processed.replace(regex, '\\$1');
                });

                // Process display math ($$...$$)
                processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
                    try {
                        const cleanLatex = latex.replace(/\\n/g, '').trim();
                        const html = katex.renderToString(cleanLatex, {
                            displayMode: true,
                            throwOnError: false,
                            strict: false
                        });
                        return `<div class="math-display my-4">${html}</div>`;
                    } catch (e) {
                        console.error('KaTeX display error:', e);
                        return match;
                    }
                });

                // Process inline math ($...$)
                processed = processed.replace(/\$([^\$\n]+?)\$/g, (match, latex) => {
                    try {
                        const cleanLatex = latex.trim();
                        const html = katex.renderToString(cleanLatex, {
                            displayMode: false,
                            throwOnError: false,
                            strict: false
                        });
                        return `<span class="math-inline">${html}</span>`;
                    } catch (e) {
                        console.error('KaTeX inline error:', e);
                        return match;
                    }
                });

                // Convert markdown to HTML
                processed = processed
                    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold text-gray-800 mt-6 mb-3">$1</h3>')
                    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-black text-gray-900 mt-8 mb-4">$1</h2>')
                    .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-black text-gray-900 mt-10 mb-5">$1</h1>')
                    .replace(/^\* (.*$)/gim, '<li class="ml-6 mb-2">$1</li>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
                    .replace(/\n\n/g, '</p><p class="mb-4">')
                    .replace(/\n/g, '<br />');

                processed = `<p class="mb-4">${processed}</p>`;

                setHtmlContent(processed);
            } catch (error) {
                console.error('Math rendering error:', error);
                setHtmlContent(text);
            }
        };

        processContent();
    }, [rawText]);

    return (
        <div
            className="prose prose-sm max-w-none text-[#2B2E4A]"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
    );
};

export default MathRenderer;
