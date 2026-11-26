// utils/story_engine.js
// 统一的分歧剧情解析引擎：负责按关卡、阶段、得分评级（S/A/B）与剧情标记解析对话流

import { LEVELS } from '../data/levels.js';
import { RECIPES } from '../data/recipes.js';
import { CHARACTERS, getPortraitPath } from '../data/characters.js?v=20261126z12';
import { RANK_META, getOutroDialogue } from '../data/story_branches.js';

function resolveStoryContext({ levelId, phase = 'intro', rank = 'A', score = 0 }) {
  const level = LEVELS.find(l => l.id === levelId) || LEVELS[0];
  const recipe = RECIPES.find(r => r.id === level.recipeId) || RECIPES[0];
  const safeRank = RANK_META[rank] ? rank : 'A';
  const safePhase = phase === 'outro' ? 'outro' : 'intro';

  const dialogueList = safePhase === 'outro'
    ? getOutroDialogue(level, safeRank)
    : (level.introDialogue || []);

  const firstNpcLine = dialogueList.find(d => d.speaker !== 'coco');
  const initialNpcId = firstNpcLine
    ? firstNpcLine.speaker
    : (level.npcId !== 'coco' ? level.npcId : 'madeleine');

  // 生成对应的分歧标记键（供后续章节或第二卷剧情条件判断）
  const branchFlag = safePhase === 'outro' ? `${level.id}_rank_${safeRank}` : null;

  return {
    level,
    recipe,
    phase: safePhase,
    rank: safeRank,
    rankMeta: RANK_META[safeRank],
    score: Number(score) || 0,
    dialogueList,
    initialLeftPortrait: getPortraitPath('coco', 'normal'),
    initialRightPortrait: getPortraitPath(initialNpcId, 'normal'),
    branchFlag
  };
}

function resolveDialogueFrame(line) {
  if (!line) return null;
  const speaker = CHARACTERS[line.speaker] || CHARACTERS.coco;
  const emotion = line.emotion || 'normal';
  const portraitUrl = getPortraitPath(speaker.id, emotion);
  const isCoco = speaker.id === 'coco';

  return {
    line,
    speaker,
    portraitUrl,
    activeSide: isCoco ? 'left' : 'right',
    isCoco
  };
}

export {
  resolveStoryContext,
  resolveDialogueFrame
};
