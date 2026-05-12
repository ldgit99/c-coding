#include <stdio.h>
#include <string.h>
#include <ctype.h>

int main(void) {
    char s[100];
    int i;

    printf("문자열 입력: ");
    fgets(s, sizeof(s), stdin);

    // fgets()로 입력받은 문자열 끝의 엔터 제거
    s[strcspn(s, "\n")] = '\0';

    // 문자열의 모든 알파벳을 소문자로 변환
    for (i = 0; s[i] != '\0'; i++) {
        s[i] = tolower(s[i]);
    }

    printf("소문자로 변환된 문자열: %s\n", s);

    return 0;
}
