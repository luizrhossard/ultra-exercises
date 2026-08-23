package com.forja.repository;

import com.forja.domain.AlertSettings;
import org.springframework.data.jpa.repository.JpaRepository;

/** [UE-28] Preferências de alerta; id = userId do atleta. */
public interface AlertSettingsRepository extends JpaRepository<AlertSettings, Long> {
}
