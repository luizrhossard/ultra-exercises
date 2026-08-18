package com.forja.repository;

import com.forja.domain.Sport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SportRepository extends JpaRepository<Sport, Long> {

    Optional<Sport> findByCode(String code);

    List<Sport> findAllByOrderByNameAsc();
}
