package com.forja.web;

import com.forja.repository.RoutineRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.NoSuchElementException;

/**
 * [UE-29] Leitura pública somente-leitura de rotina compartilhada por token.
 * Rota pública (permitAll) protegida por token aleatório de 128 bits e pelo
 * rate limit de leitura pública; expõe apenas a prescrição, sem dados do atleta.
 */
@RestController
@RequestMapping("/api/share")
@RequiredArgsConstructor
public class ShareController {

    private final RoutineRepository routines;

    record SharedItemDto(String exerciseName, int sets, String reps, int restTime) {}

    record SharedRoutineDto(String name, String sportName, List<SharedItemDto> items) {}

    @GetMapping("/{token}")
    @Transactional(readOnly = true)
    SharedRoutineDto byToken(@PathVariable String token) {
        var routine = routines.findByShareToken(token)
                .orElseThrow(() -> new NoSuchElementException("Rotina compartilhada não encontrada"));
        return new SharedRoutineDto(routine.getName(), routine.getSport().getName(),
                routine.getItems().stream()
                        .map(i -> new SharedItemDto(i.getExercise().getName(), i.getSets(), i.getReps(), i.getRestTime()))
                        .toList());
    }
}
