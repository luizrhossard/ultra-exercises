package com.forja.repository;

import com.forja.domain.RecoveryCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface RecoveryCodeRepository extends JpaRepository<RecoveryCode, Long> {

    List<RecoveryCode> findByUserIdAndUsedAtIsNull(Long userId);

    @Modifying
    @Transactional
    void deleteByUserId(Long userId);
}
