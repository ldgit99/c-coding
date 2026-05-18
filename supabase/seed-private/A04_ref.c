#include <stdio.h>
#include <string.h>

int main(void)
{
    char str1[100], str2[100], str3[100];
    char temp[100];

    printf("세 개의 단어 입력: ");
    scanf("%s %s %s", str1, str2, str3);

    // str1 과 str2 비교
    if (strcmp(str1, str2) > 0) {
        strcpy(temp, str1);
        strcpy(str1, str2);
        strcpy(str2, temp);
    }

    // str1 과 str3 비교
    if (strcmp(str1, str3) > 0) {
        strcpy(temp, str1);
        strcpy(str1, str3);
        strcpy(str3, temp);
    }

    // str2 와 str3 비교
    if (strcmp(str2, str3) > 0) {
        strcpy(temp, str2);
        strcpy(str2, str3);
        strcpy(str3, temp);
    }

    printf("사전순 출력: %s %s %s\n", str1, str2, str3);

    return 0;
}
