package com.forja.service;

import com.forja.domain.ExerciseCategory;
import com.forja.domain.ExerciseDifficulty;
import com.forja.domain.SportLevel;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalInt;

/**
 * [UE-50] Regras determinísticas que traduzem o {@link SportLevel} do atleta no
 * esporte foco em seleção (dificuldade permitida, bônus de ranking, cotas) e
 * dosagem (séries, reps/duração, descanso). Documentado em
 * docs/features/routine-generator-sport-level.md.
 */
public final class SportLevelPolicy {

    private SportLevelPolicy() {
    }

    /** Dosagem de uma categoria: séries, repetições/duração e descanso (s). */
    public record Preset(int sets, String reps, int rest) {
    }

    /** Teto de séries por exercício (inclui o bônus de foco). */
    public static final int MAX_SETS = 6;

    // ---------------------------------------------------------------- seleção

    /**
     * Bônus de dificuldade somado ao score de relevância (2×foco + melhor outro).
     * Vazio = dificuldade bloqueada para o nível. Magnitude máxima 2 (= 1 ponto de
     * relevância no foco), para que a relevância continue sendo o critério dominante.
     */
    public static OptionalInt difficultyBonus(SportLevel level, ExerciseDifficulty difficulty) {
        var d = difficulty == null ? ExerciseDifficulty.INICIANTE : difficulty;
        return switch (level) {
            case RECREATIONAL -> switch (d) {
                case INICIANTE -> OptionalInt.of(2);
                case INTERMEDIARIO -> OptionalInt.of(0);
                case AVANCADO -> OptionalInt.empty();
            };
            case AMATEUR -> switch (d) {
                case INICIANTE -> OptionalInt.of(1);
                case INTERMEDIARIO -> OptionalInt.of(1);
                case AVANCADO -> OptionalInt.empty();
            };
            case COMPETITIVE -> switch (d) {
                case INICIANTE -> OptionalInt.of(0);
                case INTERMEDIARIO -> OptionalInt.of(2);
                case AVANCADO -> OptionalInt.of(1);
            };
            case PROFESSIONAL -> switch (d) {
                case INICIANTE -> OptionalInt.of(-1);
                case INTERMEDIARIO -> OptionalInt.of(1);
                case AVANCADO -> OptionalInt.of(2);
            };
        };
    }

    private static final List<ExerciseCategory> ORDER = List.of(
            ExerciseCategory.FORCA, ExerciseCategory.PLIOMETRIA, ExerciseCategory.CORE,
            ExerciseCategory.CONDICIONAMENTO, ExerciseCategory.ESPECIFICO, ExerciseCategory.MOBILIDADE);

    /** Cotas por categoria (ordem estável) — base 2/1/1/1/1/1 ajustada por nível. */
    public static List<Map.Entry<ExerciseCategory, Integer>> quotas(SportLevel level) {
        int[] q = switch (level) {
            //                  FOR PLI COR CON ESP MOB
            case RECREATIONAL -> new int[]{2, 1, 1, 1, 1, 1};
            case AMATEUR -> new int[]{2, 1, 1, 1, 1, 1};
            case COMPETITIVE -> new int[]{2, 2, 1, 1, 1, 1};
            case PROFESSIONAL -> new int[]{2, 1, 1, 1, 2, 1};
        };
        return java.util.stream.IntStream.range(0, ORDER.size())
                .mapToObj(i -> Map.entry(ORDER.get(i), q[i]))
                .toList();
    }

    /** Tamanho máximo da rotina (cotas + preenchimento por ranking). */
    public static int maxItems(SportLevel level) {
        return switch (level) {
            case RECREATIONAL, AMATEUR -> 7;
            case COMPETITIVE, PROFESSIONAL -> 8;
        };
    }

    // ---------------------------------------------------------------- dosagem

    private static final Map<SportLevel, Map<ExerciseCategory, Preset>> PRESETS = new EnumMap<>(SportLevel.class);

    static {
        PRESETS.put(SportLevel.RECREATIONAL, Map.of(
                ExerciseCategory.FORCA, new Preset(3, "10 reps", 120),
                ExerciseCategory.PLIOMETRIA, new Preset(3, "5 reps", 120),
                ExerciseCategory.CORE, new Preset(2, "30 s", 60),
                ExerciseCategory.CONDICIONAMENTO, new Preset(3, "20 s", 90),
                ExerciseCategory.MOBILIDADE, new Preset(2, "45 s", 30),
                ExerciseCategory.ESPECIFICO, new Preset(2, "2 min", 120)));
        PRESETS.put(SportLevel.AMATEUR, Map.of(
                ExerciseCategory.FORCA, new Preset(4, "8 reps", 120),
                ExerciseCategory.PLIOMETRIA, new Preset(4, "6 reps", 90),
                ExerciseCategory.CORE, new Preset(3, "40 s", 45),
                ExerciseCategory.CONDICIONAMENTO, new Preset(5, "30 s", 60),
                ExerciseCategory.MOBILIDADE, new Preset(2, "45 s", 30),
                ExerciseCategory.ESPECIFICO, new Preset(3, "3 min", 90)));
        PRESETS.put(SportLevel.COMPETITIVE, Map.of(
                ExerciseCategory.FORCA, new Preset(4, "6 reps", 150),
                ExerciseCategory.PLIOMETRIA, new Preset(5, "6 reps", 90),
                ExerciseCategory.CORE, new Preset(3, "50 s", 45),
                ExerciseCategory.CONDICIONAMENTO, new Preset(6, "30 s", 45),
                ExerciseCategory.MOBILIDADE, new Preset(2, "60 s", 30),
                ExerciseCategory.ESPECIFICO, new Preset(4, "3 min", 75)));
        PRESETS.put(SportLevel.PROFESSIONAL, Map.of(
                ExerciseCategory.FORCA, new Preset(5, "5 reps", 180),
                ExerciseCategory.PLIOMETRIA, new Preset(5, "8 reps", 90),
                ExerciseCategory.CORE, new Preset(4, "60 s", 40),
                ExerciseCategory.CONDICIONAMENTO, new Preset(6, "40 s", 40),
                ExerciseCategory.MOBILIDADE, new Preset(3, "60 s", 30),
                ExerciseCategory.ESPECIFICO, new Preset(5, "4 min", 60)));
    }

    public static Preset preset(SportLevel level, ExerciseCategory category) {
        return PRESETS.get(level).get(category);
    }

    /**
     * Séries finais: preset do nível + 1 se o exercício tiver relevância 5 no foco
     * (exceto RECREATIONAL — progressão segura), limitado a {@link #MAX_SETS}.
     */
    public static int sets(SportLevel level, ExerciseCategory category, int focusScore) {
        int bonus = level != SportLevel.RECREATIONAL && focusScore >= 5 ? 1 : 0;
        return Math.min(MAX_SETS, preset(level, category).sets() + bonus);
    }
}
