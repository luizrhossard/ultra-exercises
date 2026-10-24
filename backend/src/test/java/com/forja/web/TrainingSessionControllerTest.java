package com.forja.web;

import com.forja.domain.AppUser;
import com.forja.domain.Routine;
import com.forja.domain.SessionStatus;
import com.forja.domain.Sport;
import com.forja.domain.TrainingSession;
import com.forja.repository.AppUserRepository;
import com.forja.repository.RoutineRepository;
import com.forja.repository.TrainingSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TrainingSessionControllerTest {
    @Mock TrainingSessionRepository sessions;
    @Mock RoutineRepository routines;
    @Mock AppUserRepository users;
    @Mock Authentication auth;

    private TrainingSessionController controller;

    @BeforeEach
    void setUp() {
        controller = new TrainingSessionController(routines, sessions, users);
        when(auth.getName()).thenReturn("athlete@example.com");
    }

    @Test
    void repeatedPlanRequestReturnsExistingSessionForTheUserAndDate() {
        AppUser user = AppUser.builder().id(1L).email("athlete@example.com").build();
        Sport sport = Sport.builder().id(1L).code("running").name("Corrida").build();
        Routine routine = Routine.builder().id(3L).user(user).sport(sport).planDate(LocalDate.now()).build();
        TrainingSession existing = TrainingSession.builder().id(8L).user(user).routine(routine).sport(sport)
                .planDate(LocalDate.now()).status(SessionStatus.IN_PROGRESS).build();
        when(users.findByEmail("athlete@example.com")).thenReturn(Optional.of(user));
        when(routines.findById(3L)).thenReturn(Optional.of(routine));
        when(sessions.findByUserIdAndPlanDate(1L, LocalDate.now())).thenReturn(Optional.of(existing));

        var result = controller.createFromRoutine(3L, auth);

        assertThat(result.id()).isEqualTo(8L);
        assertThat(result.status()).isEqualTo(SessionStatus.IN_PROGRESS);
        verify(sessions, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void recordsInterruptedStateAndDoesNotCompleteIt() {
        AppUser user = AppUser.builder().id(1L).email("athlete@example.com").build();
        Sport sport = Sport.builder().id(1L).code("running").name("Corrida").build();
        TrainingSession session = TrainingSession.builder().id(8L).user(user).sport(sport)
                .status(SessionStatus.IN_PROGRESS).build();
        when(users.findByEmail("athlete@example.com")).thenReturn(Optional.of(user));
        when(sessions.findByIdAndUserId(8L, 1L)).thenReturn(Optional.of(session));
        when(sessions.save(session)).thenReturn(session);

        var result = controller.patch(8L,
                new TrainingSessionController.SessionPatch(SessionStatus.INTERRUPTED, null, null, null), auth);

        assertThat(result.getBody().status()).isEqualTo(SessionStatus.INTERRUPTED);
        assertThat(result.getBody().completedAt()).isNull();
    }

    @Test
    void completedSessionCannotBeRewrittenAsSkipped() {
        AppUser user = AppUser.builder().id(1L).email("athlete@example.com").build();
        Sport sport = Sport.builder().id(1L).code("running").name("Corrida").build();
        TrainingSession session = TrainingSession.builder().id(8L).user(user).sport(sport)
                .status(SessionStatus.COMPLETED).build();
        when(users.findByEmail("athlete@example.com")).thenReturn(Optional.of(user));
        when(sessions.findByIdAndUserId(8L, 1L)).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> controller.patch(8L,
                new TrainingSessionController.SessionPatch(SessionStatus.SKIPPED, null, null, null), auth))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
